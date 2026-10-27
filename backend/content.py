"""Original educational fixtures. Prices are SYNTHETIC, never historical quotes."""
ASSETS = {
    "AAPL": {"name": "Apple", "kind": "Company stock", "description": "A share represents a small ownership interest in one company. One company's results can differ greatly from the wider market."},
    "MSFT": {"name": "Microsoft", "kind": "Company stock", "description": "Microsoft is a technology company, so holding its shares alongside another technology stock can still leave much of a portfolio exposed to the same sector. The companies may respond similarly to changes that affect their industry."},
    "VTI": {"name": "Vanguard Total Stock Market ETF", "kind": "Broad stock fund", "description": "This fund is designed to track a broad US stock market index rather than the performance of one company. It spreads exposure across many businesses, but it can still lose value when the wider market falls."},
    "BND": {"name": "Vanguard Total Bond Market ETF", "kind": "Broad bond fund", "description": "This fund holds many bonds, which are loans to their issuers. Its value can change as interest rates and other conditions change, so it carries investment risk and does not work like a savings account."},
}
DATES = ["2025-03-03", "2025-03-04", "2025-03-05", "2025-03-06", "2025-03-07", "2025-03-10", "2025-03-11", "2025-03-12", "2025-03-13", "2025-03-14", "2025-03-17", "2025-03-18"]
PRICES = {
    "AAPL": ["100", "102", "99", "94", "88", "90", "93", "92", "96", "101", "98", "103"],
    "MSFT": ["200", "204", "202", "190", "184", "186", "192", "195", "194", "202", "205", "208"],
    "VTI": ["100", "101", "100", "96", "93", "94", "96", "97", "98", "100", "101", "102"],
    "BND": ["75", "75.10", "75.20", "75.50", "75.80", "75.70", "75.60", "75.50", "75.40", "75.30", "75.20", "75.10"],
}
NEWS = [
    "Markets start the exercise with mixed expectations. You have only today's closing prices.",
    "Some investors feel more optimistic. A single session does not establish a lasting trend.",
    "Prices change as expectations change. Think about how much risk your plan can absorb.",
    "Uncertainty increases across the stock market. Read your original reasons before deciding.",
    "Stocks and bonds move differently today. Diversification does not guarantee a profit.",
    "Investors reassess their expectations. Today's move cannot tell you tomorrow's close.",
    "New information changes prices. What would make you revise your original reasoning?",
    "Different investments have different outcomes. Check your concentration in one sector.",
    "Review your time horizon and available virtual cash before another decision.",
    "A recent gain is not a guarantee. Compare the plan with a broad-fund benchmark.",
    "The exercise is nearing its end. Think about the quality of your process, not just profit.",
    "The exercise is complete. Compare the outcome, then reflect on risk and decision quality.",
]
PROVENANCE = {"type": "synthetic", "source": "Original team-review educational fixture; generated for this prototype", "currency": "USD", "dates": "2025-03-03 to 2025-03-18 (illustrative dates)", "adjustment": "Synthetic closing-price series; no dividends, splits, fees, taxes, interest, or external cash flows", "rule": "Execute at the current displayed session close. These are not real historical or live prices."}
SCENARIO = {"id": "changing-market", "title": "A changing market", "description": "Practice decision-making over 12 illustrative market sessions. Follow a plan while new information arrives.", "sessions": len(DATES), "benchmark": "VTI", "provenance": PROVENANCE}
STOCK_SOURCE = "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks"
RISK_SOURCE = "https://www.investor.gov/additional-resources/information/youth/teachers-classroom-resources/risk-and-return"
DIVERSIFY_SOURCE = "https://www.investor.gov/introduction-investing/getting-started/asset-allocation"
COMPOUND_SOURCE = "https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator"
LESSONS = [
    {"id": "ownership", "title": "Stocks and ownership", "category": "Ownership", "minutes": 4,
     "explanation": "A stock is a small ownership interest in a company. Shareholders may benefit when a company grows or pays dividends, but the price can fall. A familiar brand is not automatically a good investment. A stock fund holds investments on behalf of its owners; read what it owns rather than assuming every fund is diversified.",
     "example": "In this simplified example, a company has 1,000 equal shares. Owning 10 shares means owning 10 / 1,000 = 1% of those shares. It does not mean you own a particular product or can withdraw the company's money.",
     "exercise": {"type": "number", "prompt": "In that same example, what percentage do 20 shares represent?", "unit": "%", "answer": "2"},
     "question": "What does a company share represent?", "options": ["A guaranteed payment", "A small ownership interest", "A loan with no risk"], "answer": 1,
     "feedback": "A share represents ownership. Its value and dividend payments are not guaranteed.", "source": STOCK_SOURCE},
    {"id": "risk", "title": "Investment risk and returns", "category": "Risk", "minutes": 5,
     "explanation": "Return describes what you gain or lose relative to what you put in. Higher potential returns usually come with more uncertainty. You can lose money, even in a company you like. In this app all money is virtual, so losses are opportunities to examine a decision without risking real funds.",
     "example": "A $100 investment that becomes $90 has lost $10, or 10%. To return from $90 to $100 it needs a $10 / $90 = 11.11% gain. Equal percentage falls and rises do not cancel out.",
     "exercise": {"type": "number", "prompt": "An investment moves from $50 to $60. What is its percentage gain?", "unit": "%", "answer": "20"},
     "question": "A profitable outcome proves that a decision was well reasoned.", "options": ["Always true", "False: luck can affect outcomes", "True if the company is familiar"], "answer": 1,
     "feedback": "Judge the information, risk and plan you considered at the time. A good process can have a bad outcome and a weak process can get lucky.", "source": RISK_SOURCE},
    {"id": "diversification", "title": "Diversification", "category": "Diversification", "minutes": 5,
     "explanation": "Diversification spreads exposure across investments. It can reduce dependence on one company, sector or asset type, but it cannot eliminate all losses. Two similar companies are less spread out than many companies in different sectors. A narrowly focused fund can also be concentrated.",
     "example": "If all $100 is in one company that falls 20%, you lose $20. If $50 is there and $50 is in another investment that stays unchanged, the loss is $10. This example is not a forecast: both investments could fall together.",
     "exercise": {"type": "number", "prompt": "You put $80 of a $100 portfolio in one company. What percentage is concentrated there?", "unit": "%", "answer": "80"},
     "question": "Which plan spreads company-specific exposure more widely?", "options": ["All funds in one popular stock", "Two companies in the same industry", "A broad fund holding many companies"], "answer": 2,
     "feedback": "A broad fund can spread company-specific risk, although market-wide risk remains. Always check the fund's actual holdings.", "source": DIVERSIFY_SOURCE},
    {"id": "compounding", "title": "Time horizons and compounding", "category": "Planning", "minutes": 5,
     "explanation": "Your time horizon is how long until you expect to need the money. Money needed soon has less time to recover from a loss. Compounding means returns can earn further returns when reinvested. Our calculator assumes a fixed rate for illustration; actual investment returns vary and can be negative.",
     "example": "At an assumed 5% annual return, $100 becomes $105 after one year and $110.25 after two years if returns stay invested. The second year's $5.25 includes $0.25 earned on the first year's return. Fees and taxes are excluded.",
     "exercise": {"type": "number", "prompt": "At an assumed 10% yearly rate, $100 becomes $110 after year one. What is its value after year two?", "unit": "$", "answer": "121"},
     "question": "What is true about an assumed compounding rate?", "options": ["It is a guaranteed market return", "It is an illustration, not a promise", "It prevents losses"], "answer": 1,
     "feedback": "A fixed assumed rate helps explore the math. Markets do not deliver the same return each year.", "source": COMPOUND_SOURCE},
    {"id": "charts", "title": "Reading price charts", "category": "Charts", "minutes": 4,
     "explanation": "A price chart shows observations over time. Check the date range, scale, source and whether prices account for dividends and splits. Percentage change compares moves from different starting values. A chart shows the past; it cannot promise the next move.",
     "example": "A move from $200 to $210 and a move from $20 to $21 are both 5% increases. A chart with a very narrow vertical scale can make small changes look dramatic. Our replay charts show synthetic closing prices and no dividend payments.",
     "exercise": {"type": "number", "prompt": "A closing price falls from $100 to $95. What is the percentage change? Include the minus sign.", "unit": "%", "answer": "-5"},
     "question": "Before comparing two charts, what should you check?", "options": ["Only which line looks steeper", "Matching dates, scale and price conventions", "Whether the ticker is short"], "answer": 1,
     "feedback": "Comparable dates and consistent price conventions matter. A visual pattern alone is not a prediction.", "source": STOCK_SOURCE},
    {"id": "decisions", "title": "Explaining investment decisions", "category": "Decisions", "minutes": 5,
     "explanation": "A useful decision reason explains your goal, time horizon, evidence, risk and what would change your mind. Avoid buying only because a price rose yesterday. Ask how the investment fits your whole portfolio and discuss uncertainty with a parent. You can choose to hold virtual cash instead of making a trade.",
     "example": "A reasoning example: 'I am practicing a diversified plan over this scenario. I will put $100 into the broad fund rather than a single company, knowing the whole market can fall. I will review my concentration and original plan before making another decision.' This is an educational example, not a recommendation.",
     "exercise": {"type": "text", "prompt": "Write one risk you would discuss with a parent before investing (at least 20 characters)."},
     "question": "Which reason helps someone review your decision?", "options": ["Everyone is buying it", "It can only go up", "My goal, evidence, risk and review plan"], "answer": 2,
     "feedback": "Clear reasons make a decision reviewable. Learning and reflection count more than frequent trading or profit.", "source": DIVERSIFY_SOURCE},
]
GLOSSARY = {
    "Share": "A share gives its owner a small ownership interest in a company. Its price can rise or fall, and dividend payments are not guaranteed.",
    "ETF": "An exchange-traded fund holds a collection of investments and trades in shares on an exchange. Its risk depends on what it owns, so not every ETF is broadly diversified.",
    "Diversification": "Diversification spreads money across investments to reduce dependence on one company, sector, or asset type. It cannot prevent losses when several investments fall together.",
    "Benchmark": "A benchmark provides a reference for comparing performance over the same dates. Sprout compares your portfolio with investing the same starting amount in VTI and keeping those shares.",
    "Fractional share": "A fractional share is part of a full share, such as 0.5 shares. Sprout uses fractional shares so you can enter the dollar amount you want to practice with.",
    "Return": "Return measures an investment's gain or loss relative to its starting value. For example, a change from $100 to $90 is a return of minus 10%.",
    "Time horizon": "Your time horizon is how long you expect to keep money invested before you need it. A shorter horizon leaves less time to recover from a fall in value.",
    "Compounding": "Compounding happens when returns remain invested and can earn further returns. Calculations that use a fixed rate illustrate this process but do not predict actual investment returns.",
    "Gross buying": "Gross buying is the total spent on completed purchases before subtracting any sales. Sprout uses this total for the daily buying allowance, so selling does not restore that allowance.",
    "Closing price": "The closing price is the final price recorded for a market session. Sprout uses made-up closing prices to value investments and complete practice trades in its scenarios.",
}
