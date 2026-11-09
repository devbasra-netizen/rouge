import { Label } from "../components"
import { siteConfig } from "../config"

const contact = siteConfig.links.contact

export default function Privacy() {
  return (
    <article className="legal">
      <Label>Privacy notice · updated November 2026</Label>
      <h1 className="legal__title">Privacy</h1>
      <p className="legal__lede">
        ROUGE is an independent music and events brand from London, run by Dev Basra. This notice explains what we collect when you join ROUGE Members or apply to
        play on ROUGE Radio, why, how long we keep it, and your rights under UK data protection law. Questions: <a href={`mailto:${contact}`}>{contact}</a>.
      </p>

      <h2>ROUGE Members and the mailing list</h2>
      <p>
        <strong>What we collect:</strong> your first name and email address, and, only if you choose to give them, your Instagram username, area or city, the
        music you love and what you’d like to hear about. We also record when you joined, where you signed up, when you confirmed your email, and when and how
        you agreed to (or stopped) receiving emails, so we can show your consent was given.
      </p>
      <p>
        <strong>Why:</strong> to send you ROUGE news, gathering announcements and ROUGE Radio updates. We only send these if you tick the box to agree, and
        confirm your email (our lawful basis is your consent). Without that tick we only send the email that confirms your address. Your optional details help
        us tell you about the things you actually care about.
      </p>
      <p>
        <strong>Your control:</strong> every email has an unsubscribe link and a link to your preferences, where you can change your details or delete your
        membership yourself.
      </p>

      <h2>ROUGE Radio applications</h2>
      <p>
        <strong>What we collect:</strong> the details you give in the form: artist name, contact email, location, profile links, bio, music, mix links, your
        session idea and any optional details, plus your confirmations and the time you sent them.
      </p>
      <p>
        <strong>Why:</strong> to listen to and review your application and contact you about it (our lawful basis is taking steps at your request, and our
        legitimate interest in finding selectors for ROUGE Radio). Applications are reviewed by a person; nothing is decided automatically. We never publish
        your details, or announce or release anything, without agreeing it with you first. Joining ROUGE Members from the form is optional and separate.
      </p>
      <p>
        We store links, not audio files. We don’t download or copy your mixes; when we listen, we use the platform you linked to.
      </p>
      <p>
        If you leave the form half-finished, your answers are saved in your own browser on that device so you don’t lose them. They aren’t sent to us until
        you submit, and they’re cleared once you do.
      </p>

      <h2>Who processes your data</h2>
      <p>
        Our website and database run on Cloudflare. Emails are sent through Resend. They process data on our behalf and only as we instruct. We never sell
        or share your details with anyone else. This site doesn’t use advertising or analytics cookies.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Sign-ups that never confirm their email are deleted after 30 days.</li>
        <li>Members are kept until you unsubscribe or ask us to delete you. If you unsubscribe, we keep your email on a do-not-email list so we respect that choice.</li>
        <li>Radio applications that are declined, withdrawn or archived are deleted 12 months after that decision. Selected applicants’ details are kept while we work together.</li>
        <li>Basic security records (a scrambled version of your connection address, used to stop spam) are kept for no more than a couple of days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete what we hold about you, object to how we use it, or withdraw your consent at any time. Email{" "}
        <a href={`mailto:${contact}`}>{contact}</a> and we’ll respond within a month. You can also complain to the Information Commissioner’s Office (ico.org.uk).
      </p>

      <h2>Photographs</h2>
      <p>If you’d like a photo of you from a ROUGE night taken down, email us and we’ll remove it.</p>
    </article>
  )
}
