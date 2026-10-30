# Aria's Clock

A tablet app that teaches Aria to read an analog clock, on a clock face that looks like her own watch.

- 16 levels, from "meet the clock" to reading any time to the minute, with narrated intros
- Moves up after 8 of the last 10 right (adjustable); helpers and warm-ups when she's stuck, never a "fail"
- Wrong answers are real mistakes kids make (swapped hands, the wrong hour at half past, "quarter to" with the wrong hour…)
- Free play, real time, sticker book, and a grown-ups area (hold 👪 for 3 seconds)
- Works offline and installs to the home screen

## Run it

```bash
npm install
npm run dev -- --host   # open the Network URL on the iPad
npm test
```

## Voice

Every spoken line is a recorded clip in `public/voice/`, made with Gemini text-to-speech
(voice `en-au-tutor-4`). Lines without a clip use the device's built-in voice.

```bash
npm run voice -- build --voice en-au-tutor-4   # record new or changed lines (key in .env.local)
npm run voice -- verify --fix                  # listen back to every clip, drop wrong ones
npm run voice -- script                        # write VOICE_SCRIPT.csv
```
