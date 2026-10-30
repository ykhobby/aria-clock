import type { AnswerFormat } from '../store';
import { timeToDigital, timeToWords } from '../time/words';

/** Words with the numbers made big and bold, so a pre-reader can spot them. */
export function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, i) =>
        /^\d+$/.test(part) ? (
          <b key={i} className="num">
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function TimeLabel({ h, m, wordsOnly, format }: { h: number; m: number; wordsOnly?: boolean; format: AnswerFormat }) {
  const words = <Words text={timeToWords(h, m)} />;
  const digital = timeToDigital(h, m);
  if (wordsOnly) return <span className="tl tl--solo">{words}</span>;
  if (format === 'digital')
    return (
      <span className="tl">
        <span className="tl__main tl__digital">{digital}</span>
        <span className="tl__sub">{words}</span>
      </span>
    );
  if (format === 'words')
    return (
      <span className="tl">
        <span className="tl__main">{words}</span>
        <span className="tl__sub tl__digital">{digital}</span>
      </span>
    );
  return (
    <span className="tl tl--both">
      <span className="tl__main">{words}</span>
      <span className="tl__main tl__digital">{digital}</span>
    </span>
  );
}
