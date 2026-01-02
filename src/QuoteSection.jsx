import React, { useState, useEffect } from 'react';
import { Languages, ChevronDown, Volume2 } from 'lucide-react';

const gitaQuotes = [
  "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
  "योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय। सिद्ध्यसिद्ध्योः समो भूत्वा समत्वं योग उच्यते॥",
  "क्रोधाद्भवति संमोहः संमोहात्स्मृतिविभ्रमः। स्मृतिभ्रंशाद्बुद्धिनाशो बुद्धिनाशात्प्रणश्यति॥",
  "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत। अभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥",
  "परित्राणाय साधूनां विनाशाय च दुष्कृताम्। धर्मसंस्थापनार्थाय सम्भवामि युगे युगे॥"
];

const gitaTranslations = {
  en: [
    "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
    "Perform your duty equipoised, O Arjuna, abandoning all attachment to success or failure. Such equanimity is called yoga.",
    "From anger, great delusion arises, and from delusion, bewilderment of memory. When memory is bewildered, intelligence is lost, and when intelligence is lost, one falls down again into the material pool.",
    "Whenever and wherever there is a decline in religious practice, O descendant of Bharata, and a predominant rise of irreligion—at that time I descend Myself.",
    "To deliver the pious and to annihilate the miscreants, as well as to reestablish the principles of religion, I Myself appear, millennium after millennium."
  ],
  hi: [
    "तुम्हें अपने निर्धारित कर्तव्यों का पालन करने का अधिकार है, लेकिन तुम अपने कर्मों के फल के हकदार नहीं हो।",
    "हे अर्जुन, सफलता या असफलता से सभी मोह को त्यागकर, समभाव से अपना कर्तव्य निभाओ। ऐसी समता को योग कहते हैं।",
    "क्रोध से बड़ा भ्रम उत्पन्न होता है, और भ्रम से स्मृति का भ्रम होता है। जब स्मृति भ्रमित होती है, तो बुद्धि नष्ट हो जाती है, और जब बुद्धि नष्ट हो जाती है, तो व्यक्ति फिर से भौतिक कुंड में गिर जाता है।",
    "जब भी और जहाँ भी धर्म की हानि होती है, हे भरत के वंशज, और अधर्म की प्रबल वृद्धि होती है - उस समय मैं स्वयं अवतरित होता हूँ।",
    "साधुओं का उद्धार करने और दुष्टों का नाश करने के साथ-साथ धर्म के सिद्धांतों کو फिर से स्थापित करने के लिए, मैं स्वयं सहस्राब्दी के बाद सहस्राब्दी में प्रकट होता हूँ।"
  ]
};

const motivationalQuotes = [
  "The secret of getting ahead is getting started.",
  "Don't watch the clock; do what it does. Keep going.",
  "The will to win, the desire to succeed, the urge to reach your full potential... these are the keys that will unlock the door to personal excellence.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Believe you can and you're halfway there."
];

const QuoteSection = () => {
  const [gitaQuote, setGitaQuote] = useState('');
  const [translatedGitaQuote, setTranslatedGitaQuote] = useState('');
  const [isTranslated, setIsTranslated] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [gitaIndex, setGitaIndex] = useState(0);
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  useEffect(() => {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const index = dayOfYear % gitaQuotes.length;
    setGitaIndex(index);
    setGitaQuote(gitaQuotes[index]);

    // Auto-play Gita Quote on Login/First Load
    if (!sessionStorage.getItem('gita_welcome_played')) {
      window.speechSynthesis.cancel();
      
      const shlok = new SpeechSynthesisUtterance(gitaQuotes[index]);
      shlok.lang = 'hi-IN'; 
      shlok.rate = 0.8;
      window.speechSynthesis.speak(shlok);

      const meaning = new SpeechSynthesisUtterance("अर्थात " + gitaTranslations.hi[index]);
      meaning.lang = 'hi-IN';
      meaning.rate = 0.9;
      window.speechSynthesis.speak(meaning);

      sessionStorage.setItem('gita_welcome_played', 'true');
    }

    const motivationalIndex = Math.floor(Math.random() * motivationalQuotes.length);
    setMotivationalQuote(motivationalQuotes[motivationalIndex]);
  }, []);

  useEffect(() => {
    setTranslatedGitaQuote(gitaTranslations[selectedLanguage][gitaIndex]);
  }, [selectedLanguage, gitaIndex]);

  const handleTranslate = () => {
    setIsTranslated(!isTranslated);
  };

  const speakQuote = () => {
    const text = isTranslated ? translatedGitaQuote : gitaQuote;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isTranslated && selectedLanguage === 'en' ? 'en-US' : 'hi-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="p-4 space-y-4 bg-slate-900 rounded-xl border border-slate-800">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-500 mb-2">Verse of the Day (from Gita)</h3>
          <div className="flex items-center gap-2 relative">
            {showLanguageOptions && (
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setShowLanguageOptions(false);
                }}
                className="bg-slate-800 text-white text-xs rounded-md p-1 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 absolute right-16 -top-8"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            )}
            <button onClick={speakQuote} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
              <Volume2 size={14} />
              <span>Listen</span>
            </button>
            <button onClick={handleTranslate} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
              <Languages size={14} />
              <span>{isTranslated ? 'Original' : 'Translate'}</span>
            </button>
            <button onClick={() => setShowLanguageOptions(!showLanguageOptions)} className="text-slate-400 hover:text-white transition-colors">
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
        <p className="text-slate-300 text-sm fst-italic">"{isTranslated ? translatedGitaQuote : gitaQuote}"</p>
      </div>
      <div className="border-t border-slate-800"></div>
      <div>
        <h3 className="text-sm font-bold text-blue-500 mb-2">Study Motivation</h3>
        <p className="text-slate-300 text-sm fst-italic">"{motivationalQuote}"</p>
      </div>
    </div>
  );
};

export default QuoteSection;
