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
];

export const ALL_PACK_WORD_COUNT = VOCABULARY_PACKS.reduce((n, p) => n + p.words.length, 0);
