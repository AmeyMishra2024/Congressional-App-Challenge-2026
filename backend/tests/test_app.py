"""Offline integration tests use real routes, sessions and temporary databases."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import select
from backend.app import create_app, sessions, users

@pytest.fixture
def app(tmp_path):
    application = create_app({"TESTING": True, "SECRET_KEY": "test-secret-not-production", "DATABASE_URL": "sqlite:///" + (tmp_path / "test.db").as_posix()})
    yield application
    application.extensions["db"].dispose()

class Client:
    def __init__(self, app):
        self.client = app.test_client()
        self.session = self.client.get('/api/session').get_json()

    def get(self, path, status=200):
        response = self.client.get('/api' + path)
        assert response.status_code == status, response.get_json()
        return response.get_json()

    def send(self, path, data=None, method='POST', status=200, key=None):
        response = self.client.open('/api' + path, method=method, json=data or {}, headers={'X-CSRF-Token': self.session['csrf'], 'Idempotency-Key': key or str(uuid.uuid4())})
        assert response.status_code == status, response.get_json()
        result = response.get_json()
        if isinstance(result, dict) and 'csrf' in result:
            self.session = result
        return result

    def demo(self):
        self.send('/demo')
        self.cid = self.session['children'][0]['id']
        self.rid = self.get(f'/children/{self.cid}/runs')[0]['id']
        return self

    def switch(self, role):
        return self.send('/demo/switch', {'role': role, 'child_id': self.cid})

    def policy(self, **overrides):
        policy = self.get(f'/children/{self.cid}/policy')
        body = {k: policy[k] for k in ('starting', 'per_order', 'daily')}
        body.update(approval=bool(policy['approval']), paused=bool(policy['paused']))
        body.update(overrides)
        return self.send(f'/children/{self.cid}/policy', body, 'PUT')

    def quote(self, ticker='VTI'):
        return next(a for a in self.get(f'/runs/{self.rid}/market')['assets'] if a['ticker'] == ticker)['quote']['token']

    def buy(self, amount='100', ticker='VTI', side='buy', status=200, key=None, quote=None):
        return self.send(f'/runs/{self.rid}/orders', {'ticker': ticker, 'side': side, 'amount': amount, 'reason': 'My goal is to practice diversification while considering market risk.', 'quote': quote or self.quote(ticker)}, status=status, key=key)

    def replay(self):
        self.rid = self.send('/runs', {'mode': 'replay', 'scenario': 'changing-market'})['run_id']

@pytest.fixture
def family(app):
    return Client(app).demo()

def test_health_without_session_or_model(app):
    assert app.test_client().get('/api/health').get_json()['status'] == 'ok'

def test_normal_parent_child_sessions_and_restart(app):
    c = Client(app)
    c.send('/register', {'username': 'test-parent', 'password': 'long-test-password'})
    code = c.session['family_code']
    cid = c.send('/children', {'name': 'Jordan', 'pin': '123456', 'starting': '1000'})['id']
    rid = c.get(f'/children/{cid}/runs')[0]['id']
    c.send('/logout')
    c.send('/login', {'role': 'child', 'username': 'Jordan', 'family_code': code, 'password': '123456'})
    assert c.session['user']['role'] == 'child'
    c.send('/lessons/ownership/complete', {'answer': 1, 'exercise': '2'})
    c.send('/demo/switch', {'role': 'parent'}, status=403)
    db_url = app.config['DATABASE_URL']
    cookie = c.client.get_cookie('sprout_session').value
    app.extensions['db'].dispose()
    restarted = create_app({'TESTING': True, 'SECRET_KEY': 'test-secret-not-production', 'DATABASE_URL': db_url})
    new_client = restarted.test_client()
    new_client.set_cookie('sprout_session', cookie)
    assert new_client.get(f'/api/children/{cid}/progress').get_json()[0]['completed'] == 1
    assert new_client.get(f'/api/runs/{rid}').get_json()['total'] == '1000.00'
    with restarted.extensions['db'].connect() as db:
        hashes = list(db.execute(select(users.c.secret_hash)).scalars())
        assert all(h != '123456' and h != 'long-test-password' for h in hashes)
    restarted.extensions['db'].dispose()

def test_csrf_origin_and_no_browser_role_trust(family):
    c = family
    response = c.client.put(f'/api/children/{c.cid}/policy', json={})
    assert response.status_code == 403
    response = c.client.post('/api/logout', json={}, headers={'X-CSRF-Token': c.session['csrf'], 'Origin': 'https://evil.example'})
    assert response.status_code == 403
    c.switch('child')
    c.send(f'/children/{c.cid}/policy', {'role': 'parent', 'family_id': 1, 'starting': '99999'}, 'PUT', status=403)
    c.send('/children', {'name':'Intruder', 'pin':'123456'}, status=403)
    c.send(f'/runs/{c.rid}/reset', {'reason':'not authorized'}, status=403)

def test_cross_family_demo_isolation_and_cross_child(app, family):
    other = Client(app).demo()
    family.get(f'/runs/{other.rid}', status=404)
    family.get(f'/children/{other.cid}/progress', status=404)
    family.send('/demo/switch', {'role': 'child', 'child_id': other.cid}, status=404)
    sibling = family.send('/children', {'name': 'Sam', 'pin': '987654'})['id']
    sibling_run = family.get(f'/children/{sibling}/runs')[0]['id']
    family.switch('child')
    family.get(f'/runs/{sibling_run}', status=404)
    family.get(f'/children/{sibling}/goal', status=404)

def test_rate_limited_login(app):
    c = Client(app)
    for _ in range(10):
        c.send('/login', {'role':'parent','username':'absent','password':'wrong'}, status=401)
    c.send('/login', {'role':'parent','username':'absent','password':'wrong'}, status=429)

def test_fractional_cash_holdings_and_sell_does_not_restore_daily(family):
    c = family
    c.policy(approval=False)
    c.switch('child')
    order = c.buy('100', ticker='BND')
    assert order['status'] == 'filled'
    p = c.get(f'/runs/{c.rid}')
    assert p['run']['cash'] == '900.00'
    assert p['holdings'][0]['quantity'] == '1.33333333'
    assert p['holdings'][0]['basis'] == '100.00'
    assert p['total'] == '1000.00'
    c.buy('50', ticker='BND', side='sell')
    p = c.get(f'/runs/{c.rid}')
    assert p['run']['cash'] == '950.00'
    assert p['daily_spent'] == '100.00'
    assert p['daily_remaining'] == '200.00'
    assert len(p['fills']) == 2

@pytest.mark.parametrize('bad', ['NaN', 'Infinity', '-Infinity', '-1', '0', '0.001', '1000001', True, None, 'banana'])
def test_invalid_amounts(family, bad):
    family.switch('child')
    family.buy(bad, status=400)
    assert family.get(f'/runs/{family.rid}')['run']['cash'] == '1000.00'

def test_limit_insufficient_funds_oversell_and_pause(family):
    c = family
    c.policy(approval=False)
    c.switch('child')
    c.buy('201', status=409)
    c.buy('150')
    c.buy('150')
    c.buy('0.01', status=409)
    c.buy('301', side='sell', status=409)
    c.switch('parent')
    c.policy(per_order='2000', daily='3000')
    c.switch('child')
    c.buy('701', status=409)
    c.switch('parent')
    c.policy(paused=True)
    c.switch('child')
    c.buy('1', status=409)
    assert c.send('/lessons/ownership/complete', {'answer':1, 'exercise':'2'})['completed']

def test_pending_revalidation_policy_cash_and_duplicate_approval(family):
    c = family
    c.switch('child')
    order = c.buy('150')
    c.switch('parent')
    c.policy(per_order='100')
    c.send(f"/orders/{order['id']}/review", {'action':'approve','review':'Discussed risk'}, status=409)
    assert c.get(f'/runs/{c.rid}')['orders'][0]['status'] == 'pending'
    c.policy(per_order='200')
    for _ in range(2):
        assert c.send(f"/orders/{order['id']}/review", {'action':'approve','review':'Discussed risk'})['status'] == 'filled'
    assert len(c.get(f'/runs/{c.rid}')['fills']) == 1
    c.switch('child')
    pending = c.buy('150')
    c.switch('parent')
    c.policy(daily='1000', approval=False)
    c.switch('child')
    for _ in range(4):
        c.buy('200')
    c.switch('parent')
    c.send(f"/orders/{pending['id']}/review", {'action':'approve','review':'Discussed risk'}, status=409)
    assert c.get(f'/runs/{c.rid}')['run']['cash'] == '50.00'

def test_reject_cancel_and_idempotency_payload(family):
    c = family
    c.switch('child')
    order = c.buy()
    c.send(f"/orders/{order['id']}/cancel")
    other = c.buy()
    c.switch('parent')
    c.send(f"/orders/{other['id']}/review", {'action':'reject','review':'Please discuss the risk'})
    p = c.get(f'/runs/{c.rid}')
    assert p['daily_spent'] == '0.00' and not p['fills']
    c.policy(approval=False)
    c.switch('child')
    key = str(uuid.uuid4())
    quote = c.quote()
    c.buy(key=key, quote=quote)
    c.buy(key=key, quote=quote)
    c.buy('50', key=key, quote=quote, status=409)
    assert len(c.get(f'/runs/{c.rid}')['fills']) == 1

def test_replay_future_restrictions_stale_quotes_and_advance_retry(family):
    c = family
    c.switch('child')
    c.replay()
    quote = c.quote()
    order = c.buy(quote=quote)
    assert len(c.get(f'/runs/{c.rid}/market')['assets'][0]['history']) == 1
    c.get(f'/runs/{c.rid}/market?session=1', status=403)
    c.send(f'/runs/{c.rid}/orders', {'session': 5}, status=403)
    key = str(uuid.uuid4())
    for _ in range(2):
        assert c.send(f'/runs/{c.rid}/advance', {'expected_session': 0}, key=key)['session'] == 1
    c.send(f'/runs/{c.rid}/advance', {'expected_session': 0}, status=409)
    c.buy(quote=quote, status=409)
    c.switch('parent')
    c.send(f"/orders/{order['id']}/review", {'action':'approve','review':'Discussed risk'}, status=409)
    c.switch('child')
    c.send(f"/orders/{order['id']}/reconfirm", {'quote': c.quote()})
    c.switch('parent')
    c.send(f"/orders/{order['id']}/review", {'action':'approve','review':'Discussed risk'})
    p = c.get(f'/runs/{c.rid}')
    assert p['fills'][0]['price'] == '101.00'
    assert p['benchmark_value'] == '1010.00'

def test_quote_tampering_and_expiration(family, monkeypatch):
    c = family
    c.switch('child')
    c.buy(quote=c.quote() + 'tampered', status=409)
    token = c.quote()
    import itsdangerous.timed
    original = itsdangerous.timed.TimestampSigner.get_timestamp
    monkeypatch.setattr(itsdangerous.timed.TimestampSigner, 'get_timestamp', lambda self: original(self) + 601)
    c.buy(quote=token, status=409)

def test_lessons_results_goal_watchlist_and_reset(family):
    c = family
    c.switch('child')
    assert not c.send('/lessons/ownership/complete', {'answer':0,'exercise':'2'})['completed']
    assert c.send('/lessons/ownership/complete', {'answer':1,'exercise':'2'})['completed']
    assert c.get(f'/children/{c.cid}/progress')[0]['attempts'] == 2
    assert 'answer' not in c.get('/lessons')[0]['exercise']
    c.send(f'/children/{c.cid}/goal', {'title':'A future project','target':'500'}, 'PUT')
    c.send(f'/children/{c.cid}/watchlist', {'tickers':['VTI','BND']}, 'PUT')
    c.send(f'/runs/{c.rid}/reflection', {'text':'I considered market risk and would review my original plan, regardless of profit.'})
    old = c.rid
    c.switch('parent')
    c.rid = c.send(f'/runs/{old}/reset', {'reason':'Practice again together'})['run_id']
    assert c.get(f'/runs/{old}')['run']['status'] == 'archived'
    assert len(c.get(f'/children/{c.cid}/review')['events']) == 1
    assert c.get(f'/children/{c.cid}/progress')[0]['completed'] == 1
    assert c.get(f'/children/{c.cid}/goal')['target'] == '500.00'
    assert c.get(f'/children/{c.cid}/watchlist') == ['BND','VTI']

def test_benchmark_valuation_and_end_debrief(family):
    c = family
    c.policy(approval=False)
    c.switch('child')
    c.replay()
    c.buy('100')
    for session in range(11):
        c.send(f'/runs/{c.rid}/advance', {'expected_session':session})
    p = c.get(f'/runs/{c.rid}')
    assert p['total'] == '1002.00' and p['gain'] == '2.00'
    assert p['benchmark_value'] == '1020.00' and p['difference'] == '-18.00'
    assert p['ended']
    c.buy('10', status=409)
    c.send(f'/runs/{c.rid}/advance', {'expected_session':11}, status=409)

def test_concurrent_approval_executes_once(app, family):
    c = family
    c.switch('child')
    order = c.buy('100')
    c.switch('parent')
    cookie = c.client.get_cookie('sprout_session').value
    csrf = c.session['csrf']
    def approve(_):
        client = app.test_client()
        client.set_cookie('sprout_session', cookie)
        return client.post(f"/api/orders/{order['id']}/review", json={'action':'approve','review':'Reviewed together'}, headers={'X-CSRF-Token':csrf, 'Idempotency-Key':str(uuid.uuid4())}).status_code
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(approve, range(4))) == [200]*4
    assert c.get(f'/runs/{c.rid}')['run']['cash'] == '900.00'
    assert len(c.get(f'/runs/{c.rid}')['fills']) == 1
