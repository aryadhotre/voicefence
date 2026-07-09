"""Sentence generation for the synthetic Hindi-English spoof set.

Design note (methodological, important):
Spoofs are synthesised from code-switched AND monolingual Hindi AND
monolingual English text. If only code-switched text were spoofed while all
bonafide audio stayed monolingual, the detector could shortcut-learn
"language mixing ⇒ fake" — a spurious cue that collapses on real data. Text
domain covers scam scripts (emergency / bank / OTP / delivery / job) plus
neutral everyday content so the model can't shortcut on topic either.

Hindi is written in Devanagari (what Indic TTS engines expect); English
words stay in Latin script inside code-switched lines.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

# ----------------------------- slot fillers -----------------------------

NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Ananya", "Rohit",
         "Kavya", "Arjun", "Meera", "Sanjay", "Pooja", "Karan", "Divya",
         "Neha", "Aarav", "Ishaan", "Ritu", "Manoj", "Simran", "Deepak",
         "Nisha"]
RELATIONS_HI = ["पापा", "मम्मी", "भैया", "दीदी", "चाचा", "मामा", "बेटा", "बेटी",
                "पति", "पत्नी", "दोस्त", "साहब"]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Hyderabad",
          "Kolkata", "Jaipur", "Lucknow", "Ahmedabad", "Surat", "Nagpur",
          "Bhopal", "Patna"]
AMOUNTS = ["दस हज़ार", "पचास हज़ार", "बीस हज़ार", "पाँच हज़ार", "एक लाख",
           "दो लाख", "पच्चीस हज़ार", "सत्तर हज़ार", "पंद्रह हज़ार",
           "तीस हज़ार", "चालीस हज़ार", "अस्सी हज़ार"]
AMOUNTS_EN = ["ten thousand", "fifty thousand", "twenty thousand",
              "one lakh", "two lakh", "twenty five thousand",
              "fifteen thousand", "thirty thousand", "forty thousand",
              "eighty thousand"]
ITEMS = ["parcel", "documents", "laptop", "medicines", "courier", "files",
         "package", "gadget", "tablet", "phone"]
BANKS = ["SBI", "HDFC", "ICICI", "Axis Bank", "Kotak", "PNB",
         "Bank of Baroda", "Yes Bank"]
TIMES_HI = ["आधे घंटे में", "अभी", "आज शाम तक", "दस मिनट में", "कल सुबह",
            "एक घंटे में", "शाम तक", "रात तक"]
DIGITS = ["चार सात दो नौ", "आठ एक पाँच तीन", "नौ छह चार दो", "तीन आठ सात एक",
          "पाँच दो नौ छह", "एक तीन आठ पाँच", "सात नौ चार तीन", "छह चार एक आठ"]
JOBS_EN = ["bank manager", "delivery agent", "HR executive", "tax officer",
           "insurance agent", "customs officer", "college admin officer",
           "cyber cell officer"]
COURSES_EN = ["engineering", "MBA", "nursing", "medical", "law",
              "computer science"]

# ------------------------- code-switched (hi-en) -------------------------

HI_EN_TEMPLATES = [
    "{relation}, मेरा accident हो गया है, please {amount} रुपये अभी transfer कर दो।",
    "Hello {name}, मैं {bank} से बोल रहा हूँ, आपका account block हो गया है, verification के लिए OTP बताइए।",
    "{relation}, मैं police station में हूँ, bail के लिए {amount} रुपये urgent चाहिए, किसी को मत बताना।",
    "आपका {item} customs में रुका हुआ है, release करने के लिए {amount} रुपये की payment करनी होगी।",
    "{name} beta, मेरा phone खो गया है, यह नया number है, mummy को मत बताना, बस {amount} भेज दो।",
    "Sir, आपके {bank} account में suspicious activity detect हुई है, immediately यह app install कीजिए।",
    "Congratulations {name}! आपकी lottery लगी है, prize claim करने के लिए processing fee {amount} रुपये भेजिए।",
    "मैं {city} से बोल रहा हूँ, आपके बेटे का admission confirm करने के लिए {time} fees जमा करनी है।",
    "{relation}, hospital में emergency है, doctor बोल रहे हैं operation के लिए {amount} रुपये {time} चाहिए।",
    "आपका electricity bill pending है, {time} payment नहीं की तो connection cut हो जाएगा, इस number पर pay करें।",
    "Hello, मैं आपकी company के HR department से हूँ, salary account update करने के लिए अपना PAN और OTP share करें।",
    "{name}, मैं तुम्हारा senior बोल रहा हूँ, boss ने बोला है client को {amount} advance transfer करना है {time}।",
    "आपके Aadhaar card पर illegal SIM registered है, case बंद करने के लिए officer से बात कीजिए और fine भरिए।",
    "Beta, दवाई खत्म हो गई है और paytm काम नहीं कर रहा, {amount} रुपये इस number पर भेज दो please।",
    "आपका income tax refund approve हो गया है, claim करने के लिए यह link खोलिए और details भरिए।",
    "{relation}, मेरी flight miss हो गई {city} में, नई ticket के लिए {amount} चाहिए, {time} भेजना।",
    "मैं courier company से बोल रही हूँ, आपके {item} की delivery के लिए address verify करना है, OTP बताइए।",
    "तुम्हारा दोस्त {name} बोल रहा हूँ, नया number है मेरा, एक emergency है, {amount} udhaar चाहिए {time}।",
    "Ma'am, आपके card पर {amount} रुपये का transaction हुआ है, cancel करने के लिए अभी one बटन दबाइए।",
    "पापा, मैं exam center पर हूँ और form reject हो गया, late fee {amount} online भरनी है {time}।",
]

HI_EN_NEUTRAL = [
    "कल शाम को मैं {city} के लिए train पकड़ रहा हूँ, station पर मिलते हैं।",
    "आज office में meeting बहुत लंबी चली, अब घर आकर आराम करूँगा।",
    "{name} ने बताया कि नई movie बहुत अच्छी है, weekend पर देखने चलेंगे।",
    "बारिश की वजह से traffic बहुत slow है, मुझे पहुँचने में देर हो जाएगी।",
    "मैंने आज market से सब्ज़ियाँ और कुछ groceries खरीदीं, सब कुछ महँगा हो गया है।",
    "मेरा laptop ठीक से charge नहीं हो रहा, service center ले जाना पड़ेगा।",
    "अगले महीने {relation} का birthday है, हमें gift पहले से order कर देना चाहिए।",
    "क्रिकेट match बहुत exciting था, आखिरी over में {name} ने कमाल कर दिया।",
]

# ----------------------------- monolingual -----------------------------

HI_TEMPLATES = [
    "{relation}, मुझे {time} {amount} रुपये की सख्त ज़रूरत है, कृपया भेज दीजिए।",
    "आपके खाते से {amount} रुपये निकाले गए हैं, रोकने के लिए तुरंत यह नंबर मिलाइए।",
    "कल सुबह हम सब {city} जा रहे हैं, तैयारी पूरी कर लेना।",
    "बाज़ार में आज बहुत भीड़ थी, फिर भी सारा सामान मिल गया।",
    "आपके बेटे को चोट लगी है, अस्पताल में भर्ती कराया गया है, पैसे लेकर आइए।",
    "मौसम बहुत सुहावना है, चलिए शाम को बाग़ में टहलने चलते हैं।",
    "यह आपका सत्यापन कोड है: {digits}, किसी के साथ साझा मत कीजिए।",
    "मेरी तबीयत ठीक नहीं है, आज मैं दफ़्तर नहीं आ पाऊँगा।",
    "आपका {item} {city} के सीमा शुल्क विभाग में रुका हुआ है, छुड़ाने के लिए "
    "{amount} रुपये जमा कीजिए।",
    "बधाई हो {name} जी! आपकी किस्मत से {amount} रुपये का इनाम निकला है, "
    "पाने के लिए पहले शुल्क जमा कीजिए।",
    "आपके आधार नंबर पर {city} में एक अवैध सिम पंजीकृत पाई गई है, मामला बंद "
    "करवाने के लिए तुरंत अधिकारी से संपर्क करें और जुर्माना भरें।",
    "{name} का दाखिला पक्का करने के लिए {time} तक फ़ीस जमा करनी होगी, नहीं "
    "तो सीट रद्द हो जाएगी।",
    "आपका बिजली बिल बकाया है, {time} भुगतान नहीं किया तो कनेक्शन काट दिया "
    "जाएगा, इस नंबर पर तुरंत भुगतान करें।",
    "आपके {item} की डिलीवरी के लिए पता सत्यापित करना है, कृपया मोबाइल पर "
    "आया हुआ कोड हमें बताइए।",
    "{relation}, मेरी फ़्लाइट छूट गई {city} में, नई टिकट के लिए {amount} "
    "रुपये {time} भेज दीजिए।",
    "मैं तुम्हारा दोस्त {name} बोल रहा हूँ, यह मेरा नया नंबर है, एक ज़रूरी "
    "काम है, {amount} रुपये {time} उधार चाहिए।",
    "आपके कार्ड से {amount} रुपये का लेन-देन हुआ है, रोकने के लिए अभी एक "
    "दबाइए।",
    "{name} परीक्षा केंद्र पर है और फ़ॉर्म रद्द हो गया, विलम्ब शुल्क {time} "
    "ऑनलाइन भरनी होगी।",
    "कल {city} में {relation} की शादी है, हम सब साथ जाएंगे।",
    "आज क्रिकेट मैच में {name} ने शानदार पारी खेली, सब बहुत खुश हैं।",
    "इस हफ़्ते {city} जाना है काम के सिलसिले में, टिकट बुक करवा दो।",
    "{relation} का जन्मदिन अगले हफ़्ते है, तोहफ़ा पहले से मंगवा लेना चाहिए।",
    "आज सुबह से बारिश हो रही है, {city} में बाढ़ जैसे हालात हैं।",
]

EN_TEMPLATES = [
    "Hello {name}, this is {bank} security team, your account is blocked, share the OTP to verify.",
    "Dad, I lost my phone, this is my new number, please transfer {amount_en} rupees right now.",
    "Your {item} is stuck at customs in {city}, pay the release fee immediately or it gets returned.",
    "Hi {name}, are we still meeting for lunch tomorrow near the office?",
    "The weather in {city} has been lovely this week, we should plan a trip.",
    "Sir, suspicious activity was detected on your card, press one to speak to an officer now.",
    "I have attached the report you asked for, let me know if anything needs changes.",
    "Congratulations, you have won a prize of {amount_en} rupees, pay the processing fee to claim it.",
    "This is {name} calling from {bank}, we noticed unusual activity on "
    "your account, please confirm your OTP immediately.",
    "Congratulations {name}, you have been selected for a cash prize of "
    "{amount_en} rupees, share your bank details to claim it.",
    "Sir, your number is linked to a pending case, contact the {job_en} "
    "right away or a warrant will be issued.",
    "Hi, I am calling about {name}'s admission in {course_en}, please pay "
    "the fee before the deadline or the seat will be cancelled.",
    "Your electricity bill is overdue, pay {amount_en} rupees today or "
    "your connection will be disconnected.",
    "Hello, this is your {item} delivery agent, I need your verification "
    "code to confirm the address.",
    "This is {name} from the HR department, we are updating your salary "
    "account, please share your PAN and OTP.",
    "Your income tax refund of {amount_en} rupees has been approved, "
    "click the link and enter your details to claim it.",
    "{name}, my flight got cancelled in {city}, I need {amount_en} rupees "
    "for a new ticket right now.",
    "This is your friend {name}, I have a new number, it's an emergency, "
    "I need {amount_en} rupees urgently.",
    "Ma'am, a transaction of {amount_en} rupees was made on your card, "
    "press one now to cancel it.",
    "{name} is at the exam center and the form got rejected, the late fee "
    "must be paid online right now.",
    "Are we still on for the cricket match this weekend, {name}?",
    "I went shopping in {city} today, everything has become so expensive.",
    "{name}'s birthday is next week, we should order a gift in advance.",
    "It has been raining since morning, traffic in {city} is terrible today.",
]

_FILLERS = {
    "name": NAMES, "relation": RELATIONS_HI, "city": CITIES,
    "amount": AMOUNTS, "amount_en": AMOUNTS_EN, "item": ITEMS,
    "bank": BANKS, "time": TIMES_HI, "digits": DIGITS,
    "job_en": JOBS_EN, "course_en": COURSES_EN,
}

_POOLS: list[tuple[str, list[str]]] = [
    ("hi-en", HI_EN_TEMPLATES + HI_EN_NEUTRAL),
    ("hi", HI_TEMPLATES),
    ("en", EN_TEMPLATES),
]


@dataclass(frozen=True)
class Sentence:
    sid: str
    text: str
    lang: str  # 'hi-en' | 'hi' | 'en'


def _fill(template: str, rng: random.Random) -> str:
    out = template
    for key, pool in _FILLERS.items():
        while "{" + key + "}" in out:
            out = out.replace("{" + key + "}", rng.choice(pool), 1)
    return out


def expand_templates(
    n: int,
    seed: int = 1234,
    mix: dict[str, float] | None = None,
) -> list[Sentence]:
    """Generate n unique filled sentences with language-mix ratios.

    Default mix: 50% hi-en code-switched, 25% hi, 25% en.
    """
    mix = mix or {"hi-en": 0.5, "hi": 0.25, "en": 0.25}
    total = sum(mix.values())
    rng = random.Random(seed)
    sentences: list[Sentence] = []
    seen: set[str] = set()

    quotas = {lang: round(n * w / total) for lang, w in mix.items()}
    # rounding drift → give remainder to the largest pool
    drift = n - sum(quotas.values())
    if drift:
        quotas[max(quotas, key=quotas.get)] += drift

    for lang, templates in _POOLS:
        want = quotas.get(lang, 0)
        made, attempts = 0, 0
        while made < want and attempts < want * 60:
            attempts += 1
            text = _fill(rng.choice(templates), rng)
            if text in seen:
                continue
            seen.add(text)
            sid = f"AWZ_{lang.replace('-', '')}_{made:05d}"
            sentences.append(Sentence(sid, text, lang))
            made += 1
        if made < want:
            raise RuntimeError(
                f"Could only generate {made}/{want} unique '{lang}' sentences; "
                f"add templates or fillers, or lower n."
            )

    for s in sentences:
        if "{" in s.text or "}" in s.text:
            raise AssertionError(f"Unfilled slot in: {s.text!r}")
    rng.shuffle(sentences)
    return sentences
