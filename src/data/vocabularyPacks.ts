import type { SignCategory } from '../types';

export interface PackWord {
  english: string;
  hindi: string;
  category: SignCategory;
}

export interface VocabularyPack {
  id: string;
  name: string;
  description: string;
  words: PackWord[];
}

/**
 * Ready-made word lists with Hindi translations.
 *
 * These are WORDS ONLY. SignBridge ships no sign definitions and no recordings: look each
 * sign up in the ISLRTC dictionary (or learn it from a Deaf ISL signer), then record your
 * own samples in the Training Studio. A word is recognised only after it has been trained.
 */
const w = (category: SignCategory, pairs: Array<[string, string]>): PackWord[] =>
  pairs.map(([english, hindi]) => ({ english, hindi, category }));

const LETTERS_HI = ['ए', 'बी', 'सी', 'डी', 'ई', 'एफ़', 'जी', 'एच', 'आई', 'जे', 'के', 'एल', 'एम', 'एन', 'ओ', 'पी', 'क्यू', 'आर', 'एस', 'टी', 'यू', 'वी', 'डब्ल्यू', 'एक्स', 'वाई', 'ज़ेड'];

export const VOCABULARY_PACKS: VocabularyPack[] = [
  {
    id: 'alphabet',
    name: 'Fingerspelling alphabet (A–Z)',
    description: 'ISL manual alphabet letters. Many ISL letters use both hands.',
    words: LETTERS_HI.map((hindi, i) => ({ english: `Letter ${String.fromCharCode(65 + i)}`, hindi, category: 'alphabet' })),
  },
  {
    id: 'numbers',
    name: 'Numbers (0–20, tens, hundred)',
    description: 'Counting signs.',
    words: w('number', [
      ['Zero', 'शून्य'], ['One', 'एक'], ['Two', 'दो'], ['Three', 'तीन'], ['Four', 'चार'], ['Five', 'पाँच'],
      ['Six', 'छह'], ['Seven', 'सात'], ['Eight', 'आठ'], ['Nine', 'नौ'], ['Ten', 'दस'], ['Eleven', 'ग्यारह'],
      ['Twelve', 'बारह'], ['Thirteen', 'तेरह'], ['Fourteen', 'चौदह'], ['Fifteen', 'पंद्रह'], ['Sixteen', 'सोलह'],
      ['Seventeen', 'सत्रह'], ['Eighteen', 'अठारह'], ['Nineteen', 'उन्नीस'], ['Twenty', 'बीस'], ['Thirty', 'तीस'],
      ['Forty', 'चालीस'], ['Fifty', 'पचास'], ['Hundred', 'सौ'], ['Thousand', 'हज़ार'],
    ]),
  },
  {
    id: 'greetings',
    name: 'Greetings & courtesy',
    description: 'Everyday social phrases.',
    words: [
      ...w('greeting', [
        ['Hello', 'नमस्ते'], ['Goodbye', 'अलविदा'], ['Good morning', 'सुप्रभात'], ['Good afternoon', 'शुभ दोपहर'],
        ['Good night', 'शुभ रात्रि'], ['Welcome', 'स्वागत है'], ['See you', 'फिर मिलेंगे'], ['How are you', 'आप कैसे हैं'],
        ['Fine', 'ठीक'], ['Nice to meet you', 'आपसे मिलकर अच्छा लगा'],
      ]),
      ...w('courtesy', [
        ['Thank you', 'धन्यवाद'], ['Please', 'कृपया'], ['Sorry', 'माफ़ कीजिए'], ['Excuse me', 'सुनिए'],
        ['You are welcome', 'कोई बात नहीं'], ['Congratulations', 'बधाई हो'],
      ]),
    ],
  },
  {
    id: 'basics',
    name: 'Basic responses & questions',
    description: 'Yes/no, question words and short replies.',
    words: [
      ...w('other', [
        ['Yes', 'हाँ'], ['No', 'नहीं'], ['Okay', 'ठीक है'], ['Maybe', 'शायद'], ['Understand', 'समझना'],
        ['Not understand', 'समझ नहीं आया'], ['Again', 'फिर से'], ['Slow', 'धीरे'], ['Fast', 'तेज़'],
        ['More', 'और'], ['Finish', 'ख़त्म'], ['Wait', 'रुको'], ['Same', 'वही'], ['Different', 'अलग'],
        ['Good', 'अच्छा'], ['Bad', 'बुरा'], ['Big', 'बड़ा'], ['Small', 'छोटा'], ['Hot', 'गर्म'], ['Cold', 'ठंडा'],
      ]),
      ...w('question', [
        ['What', 'क्या'], ['Who', 'कौन'], ['Where', 'कहाँ'], ['When', 'कब'], ['Why', 'क्यों'], ['How', 'कैसे'],
        ['Which', 'कौन सा'], ['How much', 'कितना'], ['Name', 'नाम'],
      ]),
    ],
  },
  {
    id: 'people',
    name: 'Family & people',
    description: 'Pronouns, family members and roles.',
    words: w('family', [
      ['I', 'मैं'], ['You', 'आप'], ['He', 'वह (पुरुष)'], ['She', 'वह (महिला)'], ['We', 'हम'], ['They', 'वे'],
      ['Mother', 'माँ'], ['Father', 'पिता'], ['Brother', 'भाई'], ['Sister', 'बहन'], ['Son', 'बेटा'],
      ['Daughter', 'बेटी'], ['Grandmother', 'दादी'], ['Grandfather', 'दादा'], ['Husband', 'पति'], ['Wife', 'पत्नी'],
      ['Baby', 'बच्चा'], ['Friend', 'दोस्त'], ['Family', 'परिवार'], ['Man', 'आदमी'], ['Woman', 'औरत'],
      ['Boy', 'लड़का'], ['Girl', 'लड़की'], ['Teacher', 'शिक्षक'], ['Student', 'छात्र'], ['Doctor', 'डॉक्टर'],
      ['Police', 'पुलिस'], ['Deaf', 'बधिर'], ['Hearing', 'सुनने वाला'], ['Interpreter', 'दुभाषिया'],
    ]),
  },
  {
    id: 'needs',
    name: 'Needs & daily life',
    description: 'Common requests and everyday objects.',
    words: [
      ...w('need', [
        ['Help', 'मदद'], ['Want', 'चाहिए'], ['Need', 'ज़रूरत'], ['Toilet', 'शौचालय'], ['Sleep', 'नींद'],
        ['Money', 'पैसा'], ['Phone', 'फ़ोन'], ['Bath', 'नहाना'], ['Clothes', 'कपड़े'],
      ]),
      ...w('object', [
        ['Book', 'किताब'], ['Pen', 'पेन'], ['Bag', 'बैग'], ['Key', 'चाबी'], ['Door', 'दरवाज़ा'], ['Chair', 'कुर्सी'],
        ['Table', 'मेज़'], ['Bed', 'बिस्तर'], ['Light', 'बत्ती'], ['Computer', 'कंप्यूटर'], ['Car', 'कार'],
        ['Bus', 'बस'], ['Train', 'ट्रेन'], ['Bicycle', 'साइकिल'], ['Ticket', 'टिकट'],
      ]),
    ],
  },
  {
    id: 'food',
    name: 'Food & drink',
    description: 'Meals and common food items.',
    words: w('food', [
      ['Water', 'पानी'], ['Food', 'खाना'], ['Eat', 'खाना खाना'], ['Drink', 'पीना'], ['Hungry', 'भूख'],
      ['Thirsty', 'प्यास'], ['Tea', 'चाय'], ['Coffee', 'कॉफ़ी'], ['Milk', 'दूध'], ['Rice', 'चावल'], ['Roti', 'रोटी'],
      ['Dal', 'दाल'], ['Vegetable', 'सब्ज़ी'], ['Fruit', 'फल'], ['Apple', 'सेब'], ['Banana', 'केला'], ['Mango', 'आम'],
      ['Egg', 'अंडा'], ['Sugar', 'चीनी'], ['Salt', 'नमक'], ['Breakfast', 'नाश्ता'], ['Lunch', 'दोपहर का खाना'],
      ['Dinner', 'रात का खाना'],
    ]),
  },
  {
    id: 'emotions',
    name: 'Feelings',
    description: 'Emotions and states.',
    words: w('emotion', [
      ['Happy', 'खुश'], ['Sad', 'दुखी'], ['Angry', 'गुस्सा'], ['Afraid', 'डर'], ['Tired', 'थका हुआ'],
      ['Love', 'प्यार'], ['Like', 'पसंद'], ['Dislike', 'नापसंद'], ['Surprised', 'हैरान'], ['Bored', 'ऊब'],
      ['Worried', 'चिंतित'], ['Excited', 'उत्साहित'], ['Beautiful', 'सुंदर'],
    ]),
  },
  {
    id: 'health',
    name: 'Health & emergency',
    description: 'Useful at clinics and in emergencies.',
    words: w('health', [
      ['Pain', 'दर्द'], ['Sick', 'बीमार'], ['Hospital', 'अस्पताल'], ['Medicine', 'दवा'], ['Fever', 'बुख़ार'],
      ['Headache', 'सिरदर्द'], ['Stomach ache', 'पेट दर्द'], ['Cough', 'खाँसी'], ['Injury', 'चोट'], ['Blood', 'ख़ून'],
      ['Emergency', 'आपातकाल'], ['Ambulance', 'एम्बुलेंस'], ['Danger', 'ख़तरा'], ['Fire', 'आग'], ['Stop', 'रुकिए'],
      ['Call', 'बुलाओ'],
    ]),
  },
  {
    id: 'actions',
    name: 'Actions',
    description: 'Common verbs.',
    words: w('action', [
      ['Go', 'जाना'], ['Come', 'आना'], ['Sit', 'बैठना'], ['Stand', 'खड़ा होना'], ['Walk', 'चलना'], ['Run', 'दौड़ना'],
      ['Give', 'देना'], ['Take', 'लेना'], ['Open', 'खोलना'], ['Close', 'बंद करना'], ['Read', 'पढ़ना'], ['Write', 'लिखना'],
      ['Learn', 'सीखना'], ['Teach', 'सिखाना'], ['Work', 'काम'], ['Play', 'खेलना'], ['See', 'देखना'], ['Know', 'जानना'],
      ['Think', 'सोचना'], ['Ask', 'पूछना'], ['Tell', 'बताना'], ['Sign', 'संकेत करना'], ['Buy', 'ख़रीदना'],
      ['Wash', 'धोना'], ['Cook', 'पकाना'], ['Meet', 'मिलना'],
    ]),
  },
  {
    id: 'time',
    name: 'Time & days',
    description: 'Days of the week and time words.',
    words: w('time', [
      ['Today', 'आज'], ['Tomorrow', 'कल (आने वाला)'], ['Yesterday', 'कल (बीता हुआ)'], ['Now', 'अभी'], ['Later', 'बाद में'],
      ['Morning', 'सुबह'], ['Afternoon', 'दोपहर'], ['Evening', 'शाम'], ['Night', 'रात'], ['Day', 'दिन'], ['Week', 'हफ़्ता'],
      ['Month', 'महीना'], ['Year', 'साल'], ['Time', 'समय'], ['Monday', 'सोमवार'], ['Tuesday', 'मंगलवार'],
      ['Wednesday', 'बुधवार'], ['Thursday', 'गुरुवार'], ['Friday', 'शुक्रवार'], ['Saturday', 'शनिवार'], ['Sunday', 'रविवार'],
    ]),
  },
  {
    id: 'colours',
    name: 'Colours',
    description: 'Basic colours.',
    words: w('colour', [
      ['Red', 'लाल'], ['Blue', 'नीला'], ['Green', 'हरा'], ['Yellow', 'पीला'], ['Black', 'काला'], ['White', 'सफ़ेद'],
      ['Orange', 'नारंगी'], ['Pink', 'गुलाबी'], ['Purple', 'बैंगनी'], ['Brown', 'भूरा'], ['Colour', 'रंग'],
    ]),
  },
  {
    id: 'places',
    name: 'Places',
    description: 'Common locations.',
    words: w('place', [
      ['Home', 'घर'], ['School', 'स्कूल'], ['Office', 'दफ़्तर'], ['Shop', 'दुकान'], ['Market', 'बाज़ार'], ['Bank', 'बैंक'],
      ['Temple', 'मंदिर'], ['Station', 'स्टेशन'], ['Road', 'सड़क'], ['City', 'शहर'], ['Village', 'गाँव'], ['India', 'भारत'],
      ['Room', 'कमरा'], ['Kitchen', 'रसोई'], ['Here', 'यहाँ'], ['There', 'वहाँ'],
    ]),
  },
  {
    id: 'body',
    name: 'Body',
    description: 'Parts of the body.',
    words: w('body', [
      ['Head', 'सिर'], ['Face', 'चेहरा'], ['Eye', 'आँख'], ['Ear', 'कान'], ['Nose', 'नाक'], ['Mouth', 'मुँह'],
      ['Teeth', 'दाँत'], ['Tongue', 'जीभ'], ['Hair', 'बाल'], ['Neck', 'गर्दन'], ['Shoulder', 'कंधा'], ['Arm', 'बाँह'],
      ['Hand', 'हाथ'], ['Finger', 'उँगली'], ['Chest', 'छाती'], ['Stomach', 'पेट'], ['Back', 'पीठ'], ['Leg', 'पैर'],
      ['Knee', 'घुटना'], ['Foot', 'पाँव'], ['Heart', 'दिल'], ['Skin', 'त्वचा'],
    ]),
  },
  {
    id: 'animals',
    name: 'Animals',
    description: 'Common animals and birds.',
    words: w('animal', [
      ['Animal', 'जानवर'], ['Dog', 'कुत्ता'], ['Cat', 'बिल्ली'], ['Cow', 'गाय'], ['Buffalo', 'भैंस'], ['Goat', 'बकरी'],
      ['Horse', 'घोड़ा'], ['Camel', 'ऊँट'], ['Elephant', 'हाथी'], ['Lion', 'शेर'], ['Tiger', 'बाघ'], ['Monkey', 'बंदर'],
      ['Rabbit', 'खरगोश'], ['Mouse', 'चूहा'], ['Snake', 'साँप'], ['Bird', 'पक्षी'], ['Hen', 'मुर्गी'], ['Duck', 'बत्तख'],
      ['Peacock', 'मोर'], ['Parrot', 'तोता'], ['Fish', 'मछली'], ['Ant', 'चींटी'], ['Butterfly', 'तितली'],
    ]),
  },
  {
    id: 'nature',
    name: 'Nature & weather',
    description: 'Weather, seasons and the natural world.',
    words: w('nature', [
      ['Sun', 'सूरज'], ['Moon', 'चाँद'], ['Star', 'तारा'], ['Sky', 'आसमान'], ['Cloud', 'बादल'], ['Rain', 'बारिश'],
      ['Wind', 'हवा'], ['Storm', 'तूफ़ान'], ['Snow', 'बर्फ़'], ['Weather', 'मौसम'], ['Summer', 'गर्मी'], ['Winter', 'सर्दी'],
      ['Monsoon', 'मानसून'], ['Tree', 'पेड़'], ['Flower', 'फूल'], ['Leaf', 'पत्ता'], ['River', 'नदी'], ['Sea', 'समुद्र'],
      ['Mountain', 'पहाड़'], ['Earth', 'धरती'], ['Stone', 'पत्थर'], ['Forest', 'जंगल'], ['Garden', 'बगीचा'],
    ]),
  },
  {
    id: 'clothing',
    name: 'Clothing',
    description: 'Clothes and accessories.',
    words: w('clothing', [
      ['Shirt', 'कमीज़'], ['Trousers', 'पतलून'], ['Saree', 'साड़ी'], ['Kurta', 'कुर्ता'], ['Dress', 'पोशाक'],
      ['Shoes', 'जूते'], ['Socks', 'मोज़े'], ['Cap', 'टोपी'], ['Spectacles', 'चश्मा'], ['Watch', 'घड़ी (कलाई)'],
      ['Ring', 'अंगूठी'], ['Belt', 'बेल्ट'], ['Jacket', 'जैकेट'], ['Sweater', 'स्वेटर'], ['Umbrella', 'छाता'],
    ]),
  },
  {
    id: 'transport',
    name: 'Transport & directions',
    description: 'Getting around.',
    words: w('transport', [
      ['Auto rickshaw', 'ऑटो रिक्शा'], ['Taxi', 'टैक्सी'], ['Aeroplane', 'हवाई जहाज़'], ['Boat', 'नाव'],
      ['Motorcycle', 'मोटरसाइकिल'], ['Truck', 'ट्रक'], ['Airport', 'हवाई अड्डा'], ['Bus stop', 'बस स्टॉप'],
      ['Driver', 'चालक'], ['Journey', 'यात्रा'], ['Left', 'बाएँ'], ['Right', 'दाएँ'], ['Straight', 'सीधा'],
      ['Near', 'पास'], ['Far', 'दूर'], ['Up', 'ऊपर'], ['Down', 'नीचे'], ['Inside', 'अंदर'], ['Outside', 'बाहर'],
    ]),
  },
  {
    id: 'education',
    name: 'School & study',
    description: 'Classroom and learning words.',
    words: w('education', [
      ['Class', 'कक्षा'], ['Exam', 'परीक्षा'], ['Question', 'प्रश्न'], ['Answer', 'उत्तर'], ['Homework', 'गृहकार्य'],
      ['College', 'कॉलेज'], ['University', 'विश्वविद्यालय'], ['Paper', 'काग़ज़'], ['Pencil', 'पेंसिल'],
      ['Notebook', 'कॉपी'], ['Board', 'बोर्ड'], ['Lesson', 'पाठ'], ['Study', 'पढ़ाई'], ['Remember', 'याद रखना'],
      ['Forget', 'भूलना'], ['Mistake', 'ग़लती'], ['Correct', 'सही'], ['Wrong', 'ग़लत'], ['Easy', 'आसान'],
      ['Difficult', 'मुश्किल'],
    ]),
  },
  {
    id: 'work',
    name: 'Work & jobs',
    description: 'Occupations and the workplace.',
    words: w('work', [
      ['Job', 'नौकरी'], ['Worker', 'मज़दूर'], ['Engineer', 'इंजीनियर'], ['Farmer', 'किसान'], ['Shopkeeper', 'दुकानदार'],
      ['Nurse', 'नर्स'], ['Lawyer', 'वकील'], ['Soldier', 'सैनिक'], ['Chef', 'रसोइया'], ['Manager', 'प्रबंधक'],
      ['Boss', 'मालिक'], ['Meeting', 'बैठक'], ['Salary', 'वेतन'], ['Holiday', 'छुट्टी'], ['Busy', 'व्यस्त'],
      ['Free', 'ख़ाली'],
    ]),
  },
  {
    id: 'money',
    name: 'Money & shopping',
    description: 'Buying, paying and amounts.',
    words: w('money', [
      ['Price', 'दाम'], ['Cost', 'क़ीमत'], ['Cheap', 'सस्ता'], ['Expensive', 'महँगा'], ['Rupee', 'रुपया'], ['Pay', 'भुगतान करना'],
      ['Sell', 'बेचना'], ['Card', 'कार्ड'], ['Bill', 'बिल'], ['Shopping', 'ख़रीदारी'], ['Many', 'बहुत सारे'], ['Few', 'कुछ ही'],
      ['Less', 'कम'], ['Half', 'आधा'], ['Full', 'भरा हुआ'], ['Empty', 'ख़ाली (बर्तन)'], ['All', 'सब'], ['Some', 'कुछ'],
      ['Only', 'सिर्फ़'], ['Every', 'हर'],
    ]),
  },
  {
    id: 'home',
    name: 'Home',
    description: 'Things around the house.',
    words: w('home', [
      ['House', 'मकान'], ['Window', 'खिड़की'], ['Wall', 'दीवार'], ['Roof', 'छत'], ['Floor', 'फ़र्श'], ['Fan', 'पंखा'],
      ['Television', 'टेलीविज़न'], ['Mirror', 'आईना'], ['Soap', 'साबुन'], ['Towel', 'तौलिया'], ['Bucket', 'बाल्टी'],
      ['Plate', 'थाली'], ['Glass', 'गिलास'], ['Cup', 'कप'], ['Spoon', 'चम्मच'], ['Knife', 'चाकू'], ['Bottle', 'बोतल'],
      ['Box', 'डिब्बा'], ['Clock', 'घड़ी (दीवार)'],
    ]),
  },
  {
    id: 'describe',
    name: 'Describing words',
    description: 'Adjectives for people, things and taste.',
    words: w('describe', [
      ['New', 'नया'], ['Old', 'पुराना'], ['Young', 'जवान'], ['Long', 'लंबा'], ['Short', 'छोटा (लंबाई)'], ['Tall', 'ऊँचा'],
      ['Heavy', 'भारी'], ['Clean', 'साफ़'], ['Dirty', 'गंदा'], ['Rich', 'अमीर'], ['Poor', 'ग़रीब'], ['Strong', 'मज़बूत'],
      ['Weak', 'कमज़ोर'], ['Quiet', 'शांत'], ['Loud', 'तेज़ आवाज़'], ['Soft', 'नरम'], ['Hard', 'सख़्त'], ['Wet', 'गीला'],
      ['Dry', 'सूखा'], ['True', 'सच'], ['False', 'झूठ'], ['Important', 'ज़रूरी'], ['Ready', 'तैयार'], ['Safe', 'सुरक्षित'],
      ['Sweet', 'मीठा'], ['Sour', 'खट्टा'], ['Spicy', 'तीखा'],
    ]),
  },
  {
    id: 'more-actions',
    name: 'More actions',
    description: 'Additional everyday verbs.',
    words: w('action', [
      ['Listen', 'सुनना'], ['Speak', 'बोलना'], ['Hear', 'सुनाई देना'], ['Smell', 'सूँघना'], ['Touch', 'छूना'],
      ['Laugh', 'हँसना'], ['Cry', 'रोना'], ['Smile', 'मुस्कुराना'], ['Dance', 'नाचना'], ['Sing', 'गाना'], ['Swim', 'तैरना'],
      ['Jump', 'कूदना'], ['Climb', 'चढ़ना'], ['Fall', 'गिरना'], ['Push', 'धक्का देना'], ['Pull', 'खींचना'],
      ['Carry', 'उठाकर ले जाना'], ['Bring', 'लाना'], ['Send', 'भेजना'], ['Receive', 'प्राप्त करना'], ['Wake up', 'जागना'],
      ['Drive', 'गाड़ी चलाना'], ['Fly', 'उड़ना'], ['Start', 'शुरू करना'], ['Try', 'कोशिश करना'], ['Change', 'बदलना'],
      ['Use', 'इस्तेमाल करना'], ['Find', 'ढूँढना'], ['Lose', 'खोना'], ['Win', 'जीतना'], ['Pray', 'प्रार्थना करना'],
      ['Celebrate', 'जश्न मनाना'], ['Live', 'रहना'], ['Die', 'मरना'], ['Marry', 'शादी करना'], ['Wear', 'पहनना'],
      ['Sweep', 'झाड़ू लगाना'], ['Show', 'दिखाना'], ['Hold', 'पकड़ना'], ['Leave', 'छोड़ना'],
    ]),
  },
  {
    id: 'months',
    name: 'Months, time & festivals',
    description: 'Months, time words and major festivals.',
    words: w('time', [
      ['January', 'जनवरी'], ['February', 'फ़रवरी'], ['March', 'मार्च'], ['April', 'अप्रैल'], ['May', 'मई'], ['June', 'जून'],
      ['July', 'जुलाई'], ['August', 'अगस्त'], ['September', 'सितंबर'], ['October', 'अक्टूबर'], ['November', 'नवंबर'],
      ['December', 'दिसंबर'], ['Hour', 'घंटा'], ['Minute', 'मिनट'], ['Always', 'हमेशा'], ['Never', 'कभी नहीं'],
      ['Sometimes', 'कभी-कभी'], ['Early', 'जल्दी'], ['Late', 'देर'], ['Before', 'पहले'], ['After', 'बाद'],
      ['Birthday', 'जन्मदिन'], ['Festival', 'त्योहार'], ['Diwali', 'दीवाली'], ['Holi', 'होली'], ['Eid', 'ईद'],
      ['Christmas', 'क्रिसमस'],
    ]),
  },
  {
    id: 'more-people',
    name: 'More people & feelings',
    description: 'Relatives, groups and further emotions.',
    words: [
      ...w('family', [
        ['Uncle', 'चाचा'], ['Aunt', 'चाची'], ['Cousin', 'चचेरा भाई'], ['Neighbour', 'पड़ोसी'], ['Guest', 'मेहमान'],
        ['Child', 'बालक'], ['People', 'लोग'], ['Everyone', 'सब लोग'],
      ]),
      ...w('emotion', [
        ['Proud', 'गर्व'], ['Shy', 'शर्मीला'], ['Lonely', 'अकेला'], ['Calm', 'शांत मन'], ['Confused', 'उलझन में'],
        ['Jealous', 'ईर्ष्या'], ['Hope', 'उम्मीद'],
      ]),
    ],
  },
  {
    id: 'more-food-health',
    name: 'More food & health',
    description: 'Extra food items and medical words.',
    words: [
      ...w('food', [
        ['Bread', 'ब्रेड'], ['Butter', 'मक्खन'], ['Oil', 'तेल'], ['Juice', 'जूस'], ['Sweets', 'मिठाई'], ['Biscuit', 'बिस्कुट'],
        ['Chocolate', 'चॉकलेट'], ['Ice cream', 'आइसक्रीम'], ['Onion', 'प्याज़'], ['Potato', 'आलू'], ['Tomato', 'टमाटर'],
        ['Meat', 'मांस'], ['Curd', 'दही'], ['Grapes', 'अंगूर'], ['Coconut', 'नारियल'], ['Lemon', 'नींबू'], ['Honey', 'शहद'],
        ['Paneer', 'पनीर'],
      ]),
      ...w('health', [
        ['Injection', 'इंजेक्शन'], ['Operation', 'ऑपरेशन'], ['Vomit', 'उल्टी'], ['Allergy', 'एलर्जी'], ['Diabetes', 'मधुमेह'],
        ['Pregnant', 'गर्भवती'], ['Breathe', 'साँस लेना'], ['Dizzy', 'चक्कर'], ['Bandage', 'पट्टी'], ['Healthy', 'स्वस्थ'],
        ['Rest', 'आराम'], ['Accident', 'दुर्घटना'], ['Thief', 'चोर'],
      ]),
    ],
  },
  {
    id: 'more-places',
    name: 'More places',
    description: 'Public places and services.',
    words: w('place', [
      ['Park', 'पार्क'], ['Hotel', 'होटल'], ['Restaurant', 'रेस्टोरेंट'], ['Post office', 'डाकघर'],
      ['Police station', 'थाना'], ['Court', 'अदालत'], ['Church', 'गिरजाघर'], ['Mosque', 'मस्जिद'], ['Gurudwara', 'गुरुद्वारा'],
      ['Library', 'पुस्तकालय'], ['Cinema', 'सिनेमा'], ['Farm', 'खेत'], ['Factory', 'कारख़ाना'], ['Country', 'देश'],
      ['World', 'दुनिया'],
    ]),
  },
  {
    id: 'technology',
    name: 'Technology',
    description: 'Phones, internet and media.',
    words: w('technology', [
      ['Internet', 'इंटरनेट'], ['Email', 'ईमेल'], ['Message', 'संदेश'], ['Video', 'वीडियो'], ['Camera', 'कैमरा'],
      ['Charger', 'चार्जर'], ['Photo', 'फ़ोटो'], ['Video call', 'वीडियो कॉल'],
    ]),
  },
];

export const ALL_PACK_WORD_COUNT = VOCABULARY_PACKS.reduce((n, p) => n + p.words.length, 0);
