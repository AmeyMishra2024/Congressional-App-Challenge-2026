from concurrent.futures import ThreadPoolExecutor
import uuid
import pytest
from backend.tests.test_app import app, family, Client
from backend.app import create_app

@pytest.mark.parametrize('lesson,answer,exercise', [('ownership',1,'2'),('risk',1,'20'),('diversification',2,'80'),('compounding',1,'121'),('charts',1,'-5'),('decisions',2,'A broad market loss could affect the fund even when I diversify.')])
def test_all_six_lessons(family, lesson, answer, exercise):
    family.switch('child')
    assert family.send(f'/lessons/{lesson}/complete', {'answer':answer,'exercise':exercise})['completed']
    family.get('/lessons')
    assert family.get(f'/children/{family.cid}/progress')[0]['completed'] == 1

def test_trusted_execution_price_and_cross_family_order_review(app, family):
    c = family
    c.switch('child')
    order = c.send(f'/runs/{c.rid}/orders', {'ticker':'VTI','side':'buy','amount':'100','price':'0.01','role':'parent','reason':'I considered the market risk in a broad fund.','quote':c.quote()})
    other = Client(app).demo()
    other.send(f"/orders/{order['id']}/review", {'action':'approve','review':'not their child'}, status=404)
    c.switch('parent')
    c.send(f"/orders/{order['id']}/review", {'action':'approve','review':'We discussed risk together'})
    assert c.get(f'/runs/{c.rid}')['fills'][0]['price'] == '100.00'

def test_normal_child_wrong_family_pin_and_parent_login(app):
    c = Client(app)
    c.send('/register', {'username':'family-one','password':'secure-long-pass'})
    code = c.session['family_code']
    c.send('/children', {'name':'Taylor','pin':'123456'})
    c.send('/logout')
    c.send('/login', {'role':'child','username':'Taylor','family_code':'99999','password':'123456'}, status=401)
    c.send('/login', {'role':'child','username':'Taylor','family_code':code,'password':'654321'}, status=401)
    c.send('/login', {'role':'parent','username':'family-one','password':'secure-long-pass'})
    assert c.session['user']['role'] == 'parent'

def test_concurrent_buys_enforce_gross_cap(app, family):
    c = family
    c.policy(approval=False, daily='100')
    c.switch('child')
    quote = c.quote()
    cookie, csrf = c.client.get_cookie('sprout_session').value, c.session['csrf']
    def buy(_):
        client = app.test_client()
        client.set_cookie('sprout_session', cookie)
        return client.post(f'/api/runs/{c.rid}/orders', json={'ticker':'VTI','side':'buy','amount':'75','reason':'I am considering market uncertainty with a small practice investment.','quote':quote}, headers={'X-CSRF-Token':csrf, 'Idempotency-Key':str(uuid.uuid4())}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(buy, range(2))) == [200,409]
    assert c.get(f'/runs/{c.rid}')['daily_spent'] == '75.00'

def test_reset_does_not_erase_daily_spending(family):
    c = family
    c.policy(approval=False)
    c.switch('child')
    c.buy('200')
    c.switch('parent')
    c.rid = c.send(f'/runs/{c.rid}/reset', {'reason':'Try a different decision process'})['run_id']
    assert c.get(f'/runs/{c.rid}')['daily_spent'] == '200.00'
    c.switch('child')
    c.buy('101',status=409)

def test_provider_failure_does_not_break_local_learning(app, family, monkeypatch):
    from backend.market import YahooProvider
    app.config['ENABLE_LIVE_MARKET'] = True
    monkeypatch.setattr(YahooProvider, 'history', classmethod(lambda cls, ticker: (_ for _ in ()).throw(TimeoutError())))
    family.get('/market/history/VTI',status=503)
    assert family.get(f'/runs/{family.rid}')['total'] == '1000.00'
    assert len(family.get('/lessons')) == 6
    assert family.get('/predict')['available'] is False

def test_production_requires_secure_configuration_and_blocks_bad_hosts(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('SECRET_KEY', 'x' * 64)
    monkeypatch.setenv('SESSION_COOKIE_SECURE', 'false')
    config = {'DATABASE_URL': 'sqlite:///' + (tmp_path / 'production.db').as_posix()}
    with pytest.raises(RuntimeError):
        create_app(config)
    monkeypatch.setenv('SESSION_COOKIE_SECURE', 'true')
    monkeypatch.setenv('TRUSTED_HOSTS', 'localhost')
    app = create_app(config)
    client = app.test_client()
    response = client.get('/api/session', base_url='https://localhost')
    assert response.status_code == 200
    assert 'Secure' in response.headers['Set-Cookie'] and 'HttpOnly' in response.headers['Set-Cookie']
    assert response.headers['Strict-Transport-Security'] == 'max-age=31536000'
    assert client.get('/api/health', base_url='https://untrusted.example').status_code == 400
    app.extensions['db'].dispose()

def test_filled_replay_positions_clock_and_reflection_survive_restart(app, family):
    c = family
    c.policy(approval=False)
    c.switch('child')
    c.replay()
    c.buy('100', ticker='BND')
    c.send(f'/runs/{c.rid}/advance', {'expected_session':0})
    content = 'I reviewed company concentration and considered market losses independently of the outcome.'
    c.send(f'/runs/{c.rid}/reflection', {'text':content})
    cookie = c.client.get_cookie('sprout_session').value
    app.extensions['db'].dispose()
    restarted = create_app({'TESTING':True,'SECRET_KEY':'test-secret-not-production','DATABASE_URL':app.config['DATABASE_URL']})
    client = restarted.test_client()
    client.set_cookie('sprout_session', cookie)
    portfolio = client.get(f'/api/runs/{c.rid}').get_json()
    assert portfolio['run']['session'] == 1
    assert portfolio['run']['cash'] == '900.00'
    assert portfolio['holdings'][0]['quantity'] == '1.33333333'
    assert portfolio['total'] == '1000.13'
    assert len(portfolio['fills']) == 1
    assert portfolio['reflections'][0]['text'] == content
    restarted.extensions['db'].dispose()
