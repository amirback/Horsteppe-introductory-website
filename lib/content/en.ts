import type { SiteDict } from "./types.ts";

export const en: SiteDict = {
  meta: {
    title: "Horsteppe — finished videos from a brief or a product photo",
    description:
      "An AI director and editor: script, storyboard, real AI video for key shots, voice, subtitles and the final cut. You get an MP4 that is ready to post. Join early access.",
  },
  nav: {
    features: "Features",
    how: "How it works",
    useCases: "Who it's for",
    faq: "FAQ",
    signIn: "Sign in",
    cta: "Early access",
    menu: "Menu",
    close: "Close",
    skip: "Skip to content",
    language: "Language",
  },
  hero: {
    kicker: "AI video director and editor",
    title: "Describe the video. Get a finished MP4.",
    sub:
      "Horsteppe writes the script, plans the shots, generates real AI video for the key scenes, records the voice, burns in subtitles and edits it all together. All that's left is to post it.",
    primary: "Get early access",
    secondary: "How it works",
    proof: ["10+ clients already get their videos", "Startup Orda 2 accelerator", "Reels · Shorts · TikTok · YouTube"],
  },
  demo: {
    label: "Video brief",
    prompt: "An ad for a steel bottle: keeps drinks cold for 12 hours, light, made for students",
    steps: ["Script", "Storyboard", "AI video", "Voice", "Subtitles", "Edit"],
    timeline: "Timeline · 8 shots",
    real: "AI video",
    camera: "Camera move",
    done: "Done",
    file: "MP4 · 1080×1920 · 0:30",
  },
  contrast: {
    kicker: "Why Horsteppe",
    title: "Generators hand you clips. Horsteppe delivers the result.",
    sub:
      "Video models produce separate 5–10 second fragments. The script, edit, voice and quality check are usually assembled by hand in other tools — Horsteppe does it for you and owns the finished video.",
    them: {
      label: "A typical generator",
      items: [
        "A single 5–10 second clip",
        "You come up with the script and shots",
        "Voice, subtitles and editing happen elsewhere",
        "Defects show up only after you rewatch everything",
      ],
    },
    us: {
      label: "Horsteppe",
      items: [
        "A finished 15, 30 or 60 second video",
        "Script and storyboard by an AI director",
        "Voice, subtitles and editing built in",
        "Every video is checked automatically before delivery",
      ],
    },
  },
  how: {
    kicker: "How it works",
    title: "Four steps from brief to file",
    steps: [
      {
        title: "Describe the task",
        text: "A couple of sentences about the video — or photos of your product and its key benefits. Pick a format and a length.",
      },
      {
        title: "The AI director stages it",
        text: "Writes the script and breaks every scene into shots: wide, detail, close-up — not one picture per scene.",
      },
      {
        title: "Horsteppe shoots and edits",
        text: "Generates the frames, makes real AI video for the key scenes, records the voice and cuts the video to the exact length of the narration.",
      },
      {
        title: "Checked and delivered",
        text: "The video is checked automatically and weak shots are fixed. Watch it in the browser and download the MP4.",
      },
    ],
  },
  features: {
    kicker: "Features",
    title: "Everything a video needs, in one place",
    sub: "No film crew, no stock footage, no editor.",
    items: [
      {
        icon: "script",
        title: "Script and storyboard",
        text: "Shots of 2–5 seconds: 6 to 15 distinct shots per half minute instead of a slideshow. The description of the characters and setting carries into every scene.",
      },
      {
        icon: "motion",
        title: "Real AI video where it matters",
        text: "Kling 2.5 Turbo via Higgsfield brings the hook, the product and the climax to life. Background shots get camera moves, so you don't pay for motion nobody notices.",
      },
      {
        icon: "product",
        title: "Ads from your product photos",
        text: "Up to five photos. The frame shows your actual product — not a lookalike invented by AI. The video ends on a brand card with a call to action.",
      },
      {
        icon: "photo",
        title: "Bring a photo to life",
        text: "Upload a still and get moving video: camera, light and natural motion in the frame.",
      },
      {
        icon: "voice",
        title: "Voice and subtitles",
        text: "A narrator reads the script and subtitles are burned into the frame, Cyrillic included. Or go without a voice and let the picture carry the ad.",
      },
      {
        icon: "formats",
        title: "Social formats",
        text: "9:16 for Reels, Shorts and TikTok, 16:9 for YouTube, 1:1 for feeds. Length: 15, 30 or 60 seconds.",
      },
      {
        icon: "quality",
        title: "Automatic quality check",
        text: "Before delivery, every video is checked for black and frozen frames, silence and length. A bad shot is fixed without rebuilding the whole video.",
      },
      {
        icon: "honest",
        title: "An honest result",
        text: "Next to the player you see how much of the video is real AI footage and what made it. If something didn't work out, we say so.",
      },
    ],
  },
  useCases: {
    kicker: "Who it's for",
    title: "For teams that need video on a schedule",
    exampleLabel: "For example",
    items: [
      {
        title: "Sellers and shops",
        text: "Product ads from your own photos — for marketplaces, Reels and TikTok.",
        example: "Steel bottle: keeps drinks cold for 12 hours, fits in a backpack",
      },
      {
        title: "Marketers and SMM",
        text: "A steady stream of videos for the content plan, without a production team or an editing queue.",
        example: "Three videos for a new collection launch — vertical and horizontal",
      },
      {
        title: "Agencies",
        text: "Drafts and finished videos for clients in minutes, not days.",
        example: "Ad options for a coffee shop to review with the client",
      },
      {
        title: "Brands and experts",
        text: "Explainers and product stories of 15–60 seconds.",
        example: "How delivery works — in plain words, in 30 seconds",
      },
    ],
  },
  access: {
    kicker: "Early access",
    title: "We onboard new clients in waves",
    sub:
      "To help everyone with their first videos, we open access in batches. Leave a request — we'll reach out personally, talk through your task and get you set up.",
    perks: [
      "Personal onboarding and help with your first videos",
      "Price and terms agreed upfront, before any work starts",
      "A direct line to the Horsteppe team",
    ],
    form: {
      name: "Name",
      email: "Email",
      contact: "Phone or Telegram",
      contactHint: "Helps us reach you faster",
      company: "Company or brand",
      optional: "optional",
      useCase: "What videos do you need",
      useCaseOptions: {
        product_ads: "Product ads",
        social: "Social media videos",
        animate_photo: "Bring a photo to life",
        agency: "Videos for agency clients",
        explainers: "Explainer videos",
        other: "Something else",
      },
      volume: "Videos per month",
      volumeOptions: { "1-5": "1–5", "6-20": "6–20", "21-50": "21–50", "50+": "More than 50" },
      choose: "Choose",
      message: "A few words about the task",
      messagePlaceholder: "What we're advertising, for whom, and where the video will run",
      consentBefore: "I agree to the processing of my data so that you can contact me about early access.",
      consentLink: "How we store data",
      consentAfter: "",
      submit: "Send request",
      sending: "Sending…",
      successTitle: "Request received",
      successText: "We'll reach out at {email} or via the contact you left. If you don't see our email, check your spam folder.",
      again: "Send another request",
      errors: {
        name: "Please enter your name.",
        email: "Please check your email — the address looks wrong.",
        consent: "We need your consent to be able to contact you.",
        invalid: "Please check the form fields.",
        rate_limited: "Several requests have already come from your address. Try again in an hour or email us at Horsteppe@gmail.com.",
        unavailable: "Sign-up is temporarily unavailable. Email us at Horsteppe@gmail.com — we'll reply personally.",
        network: "No connection. Check your internet and try again.",
      },
    },
  },
  faq: {
    kicker: "FAQ",
    title: "The short version",
    more: "Didn't find your answer? Write to us:",
    items: [
      {
        q: "What is Horsteppe?",
        a: "A service that makes finished videos from a brief or a product photo: script, shots, real AI video in the key scenes, voice, subtitles and the edit. You get an MP4 that is ready to post.",
      },
      {
        q: "How long does a video take?",
        a: "Usually a few minutes. It renders in the background: you can close the page and come back to the finished video later.",
      },
      {
        q: "Do I need editing skills?",
        a: "No. You describe the task and get a finished file. Want it different? Refine the brief and build the video again.",
      },
      {
        q: "Which formats and lengths?",
        a: "9:16 for Reels, Shorts and TikTok, 16:9 for YouTube and 1:1 for feeds. Length: 15, 30 or 60 seconds.",
      },
      {
        q: "Which languages can the voice speak?",
        a: "The narrator speaks the language of your brief — English, Russian and others. Need a specific language? Ask us and we'll test it on your task.",
      },
      {
        q: "Can I advertise my own product?",
        a: "Yes. Upload up to five photos: the shots show your actual product, not a lookalike invented by AI. The video ends on a card with your brand name and a call to action.",
      },
      {
        q: "Who owns the rights to the video?",
        a: "We transfer to you all the rights to the video that we hold ourselves, and we never use it without your consent. Keep in mind that some AI-generated elements are not protected by copyright in a number of countries — that is a property of the technology. Rights to the materials you upload, such as photos and logos, stay with you.",
      },
      {
        q: "How much does it cost?",
        a: "The price depends on the length and on how many shots need real AI video. We quote the price and terms upfront, before any work starts. Leave a request and we'll estimate your task.",
      },
      {
        q: "What happens to the data from the form?",
        a: "We use it only to contact you about early access. We don't sell it or share it for advertising. We'll delete it as soon as you ask.",
      },
      {
        q: "I'm already a client — where are my videos?",
        a: "In your Horsteppe account: use the “Sign in” button at the top of the page.",
      },
    ],
  },
  final: {
    title: "Video without a shoot or an edit",
    sub: "Leave a request — we'll show you how Horsteppe can handle your task.",
    cta: "Leave a request",
  },
  footer: {
    tagline: "An AI video director and editor. From an idea to the final cut.",
    contact: "Contact",
    privacy: "Data processing",
    signIn: "Sign in to your account",
    rights: "All rights reserved.",
    orda: "Startup Orda 2 accelerator participant",
  },
  privacy: {
    title: "How we handle data from the early access form",
    updated: "Updated 3 November 2026",
    intro: "What we learn about you when you leave a request, why, and how to have it deleted. No fine print.",
    sections: [
      { h: "Who processes the data", p: ["Horsteppe. For any question about your data, email Horsteppe@gmail.com."] },
      {
        h: "What we collect",
        p: [
          "What you entered in the form: name, email, phone or Telegram, company, your answers about the task and your message.",
          "Automatically: the page language, where you came from (ad tags and the referring site), and your country and city based on your IP address. We do not store the IP address itself; to protect against spam, an irreversible fingerprint of the address is kept for two days and cannot be turned back into the address.",
        ],
      },
      {
        h: "Why",
        p: ["To contact you about early access, discuss your task and set you up with the service. We don't use the data for advertising and we don't sell it."],
      },
      {
        h: "Where it is stored",
        p: [
          "In the service database with our providers: Supabase (database) and Vercel (website hosting). Notifications about new requests may be delivered to the Horsteppe team in Telegram.",
        ],
      },
      { h: "How long we keep it", p: ["For as long as we need it to contact you about early access, or until you ask us to delete it."] },
      {
        h: "Your rights",
        p: [
          "You can ask what data we hold about you, correct it or delete it. Email Horsteppe@gmail.com from the address you entered in the form and we'll do it.",
        ],
      },
      { h: "Consent", p: ["By submitting the form you agree to the processing of your data for these purposes. You can withdraw consent by email at any time."] },
    ],
    back: "Back to home",
  },
  notFound: {
    title: "Page not found",
    text: "This page doesn't exist — the link may be out of date.",
    home: "Back to home",
  },
};
