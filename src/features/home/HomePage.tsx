import { usePageTitle } from '../../app/usePageTitle';
import { useAppState } from '../../app/StoreContext';
import { Icon } from '../../components/Icon';
import { formatCurrencyWhole } from '../../utils/format';
import { Pipeline } from './Pipeline';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const inWords = (n: number): string => NUMBER_WORDS[n] ?? String(n);

const STAGES: ReadonlyArray<{ title: string; text: string; href: string | null; link: string | null }> = [
  {
    title: 'Configure',
    text: 'An instructor sets the assets, risk ratings, fee, score weights and market scenarios, in the browser or by importing an Excel workbook that is checked row by row.',
    href: '#/instructor/settings',
    link: 'Instructor workspace',
  },
  {
    title: 'Simulate',
    text: 'A student reads each scenario, picks a risk profile and splits the portfolio. A projection shows the effect before anything is submitted.',
    href: '#/student',
    link: 'Student simulation',
  },
  {
    title: 'Verify',
    text: 'Every result lists its calculation step by step. The engine behind it is tested against the values saved in a reference Excel workbook.',
    href: null,
    link: null,
  },
  {
    title: 'Review',
    text: 'Round reports, a balance history and a CSV export show how decisions played out. Instructors can compare every session stored in the browser.',
    href: '#/instructor/sessions',
    link: 'Sessions and results',
  },
];

export function HomePage() {
  usePageTitle('Home');
  const { config } = useAppState();

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="page-title">
        <h1 id="page-title" tabIndex={-1}>An investment simulation that shows its working.</h1>
        <p className="home-lede">
          SimuLab turns the rules of a spreadsheet game into a web simulation. Students invest a fictional {formatCurrencyWhole(config.startingBalance)} across{' '}
          {inWords(config.assets.length)} asset classes over {inWords(config.scenarios.length)} market rounds, and every balance and score comes with the
          formula and numbers that produced it.
        </p>
        <div className="home-actions">
          <a className="btn btn-primary btn-lg" href="#/student">
            Start the simulation
          </a>
          <a className="btn btn-lg" href="#/instructor/settings">
            Open the instructor workspace
          </a>
        </div>
      </section>

      <Pipeline config={config} />

      <section className="home-how" aria-labelledby="how-title">
        <h2 id="how-title">How a simulation runs</h2>
        <ol className="how-steps">
          {STAGES.map((stage, index) => (
            <li key={stage.title} className="how-step">
              <span className="how-n" aria-hidden="true">{index + 1}</span>
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
              {stage.href && stage.link && <a href={stage.href}>{stage.link}</a>}
            </li>
          ))}
        </ol>
      </section>

      <section className="home-paths" aria-label="Ways in">
        <div className="path path-student">
          <h2>Play the simulation</h2>
          <p>
            {inWords(config.scenarios.length).replace(/^./, (c) => c.toUpperCase())} rounds, one decision each. Your allocation carries over between rounds, so you
            adjust rather than start again, and you finish with a rating, a balance history and a CSV of your decisions.
          </p>
          <a className="btn btn-light btn-lg" href="#/student">
            Start the simulation
          </a>
        </div>
        <div className="path path-instructor">
          <div className="row">
            <h2>Set up the scenarios</h2>
            <span className="pill">
              <Icon name="user" size={14} />
              Demo role, no login
            </span>
          </div>
          <p>
            Edit assumptions as a validated draft, reorder rounds, or import a workbook and preview it before applying. This is a demonstration role switch, not
            access control: anyone using this browser can open it.
          </p>
          <a className="btn btn-lg" href="#/instructor/settings">
            Open the instructor workspace
          </a>
        </div>
      </section>

      <section className="home-note" aria-labelledby="about-heading">
        <h2 id="about-heading">About this project</h2>
        <p>
          SimuLab is an independent student portfolio project about turning spreadsheet formulas and game rules into tested web application logic. It is not
          affiliated with any university. All scenarios are invented for teaching and nothing here is financial advice. Everything is stored in this browser;
          there is no server and no account.
        </p>
      </section>
    </div>
  );
}
