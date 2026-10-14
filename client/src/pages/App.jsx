import Admin from "../components/Admin.jsx";
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Bike,
  Clock3,
  Gavel,
  ShieldCheck,
  Search,
  Gauge,
  MapPin,
  LogOut,
  UserRound,
  Zap,
  ChevronRight
} from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../lib/api.js';
const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n || 0);
const sample = [
  {
    _id: 'demo1',
    title: '2022 Royal Enfield Interceptor 650',
    make: 'Royal Enfield',
    model: 'Interceptor 650',
    year: 2022,
    mileageKm: 8400,
    location: 'Bengaluru, Karnataka',
    startingPrice: 180000,
    currentPrice: 212000,
    minIncrement: 1000,
    bidCount: 18,
    status: 'live',
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    imageUrl:
      'https\://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85',
    description:
      'A beautifully maintained modern classic with service history and clean ownership.'
  },
  {
    _id: 'demo2',
    title: '2021 Triumph Street Twin 900',
    make: 'Triumph',
    model: 'Street Twin 900',
    year: 2021,
    mileageKm: 6200,
    location: 'Pune, Maharashtra',
    startingPrice: 360000,
    currentPrice: 387000,
    minIncrement: 2000,
    bidCount: 12,
    status: 'live',
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    imageUrl:
      'https\://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=85',
    description:
      'Premium roadster, carefully inspected, with documented maintenance.'
  },
  {
    _id: 'demo3',
    title: '2020 Kawasaki Ninja 650',
    make: 'Kawasaki',
    model: 'Ninja 650',
    year: 2020,
    mileageKm: 11900,
    location: 'Hyderabad, Telangana',
    startingPrice: 420000,
    currentPrice: 445000,
    minIncrement: 2500,
    bidCount: 21,
    status: 'live',
    endsAt: new Date(Date.now() + 5400000).toISOString(),
    imageUrl:
      'https\://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=85',
    description:

      'Sport touring performance with a transparent condition report.'

  },

  {

    _id: 'demo4',

    title: '2023 Honda CB350 RS',

    make: 'Honda',

    model: 'CB350 RS',

    year: 2023,

    mileageKm: 3100,

    location: 'Chennai, Tamil Nadu',

    startingPrice: 150000,

    currentPrice: 158000,

    minIncrement: 1000,

    bidCount: 9,

    status: 'live',

    endsAt: new Date(Date.now() + 10800000).toISOString(),

    imageUrl:

      'https\://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=85',

    description:

      'Low-mileage scrambler-inspired motorcycle in excellent condition.'

  }

];



function Header({ user, onLogout }) {

  return (

    <header className="header">

      <Link className="brand" to="/">

        <span className="brand-icon"><Bike size={22} /></span>

        rev<span>bid</span>

        <small> MOTORCYCLE AUCTIONS</small>

      </Link>



      <nav>

        <a href="#auctions">Explore auctions</a>

        <a href="#how">How it works</a>

      </nav>



      <div className="head-actions">

        {user ? (

          <>

            <span className="user-chip">

              <UserRound size={15} /> {user.name}

            </span>

            <button className="btn btn-ghost btn-sm" onClick={onLogout}>

              <LogOut size={15} /> Sign out

            </button>

          </>

        ) : (

          <a className="btn btn-dark btn-sm" href="#login">

            Sign in <ArrowRight size={15} />

          </a>

        )}

      </div>

    </header>

  );

}



function AuctionCard({ a }) {

  const ends = new Date(a.endsAt);



  return (

    <Link to={`/auction/${a._id}`} className="auction-card">

      <div

        className="bike-photo"

        style={{

          backgroundImage: `url(${a.imageUrl || sample[0].imageUrl})`

        }}

      >

        <span className={`status-pill ${a.status === 'live' ? 'is-live' : ''}`}>

          <i />

          {a.status === 'live' ? 'LIVE NOW' : a.status.toUpperCase()}

        </span>

        <span className="photo-year">{a.year}</span>

      </div>



      <div className="card-content">

        <div className="eyebrow">{a.make} <span>·</span> {a.model}</div>

        <h3>{a.title}</h3>



        <div className="spec-row">

          <span>

            <Gauge size={15} />

            {Number(a.mileageKm).toLocaleString('en-IN')} km

          </span>

          <span>

            <MapPin size={15} /> {a.location || 'India'}

          </span>

        </div>



        <div className="card-bottom">

          <div>

            <small>CURRENT BID</small>

            <strong>{money(a.currentPrice)}</strong>

          </div>

          <div className="bid-count">

            <Gavel size={15} /> {a.bidCount || 0} bids

            <ChevronRight size={17} />

          </div>

        </div>



        <div className="card-timer">

          <Clock3 size={14} />

          Ends {ends.toLocaleDateString('en-IN', {

            day: 'numeric',

            month: 'short'

          })} · {ends.toLocaleTimeString('en-IN', {

            hour: '2-digit',

            minute: '2-digit'

          })}

        </div>

      </div>

    </Link>

  );

}



function Home({ user, setUser }) {

  const [auctions, setAuctions] = useState(sample);

  const [status, setStatus] = useState('live');

  const [query, setQuery] = useState('');

  const [authMode, setAuthMode] = useState('login');

  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    api.get('/auctions?limit=24')

      .then(r => {

        if (r.data.items?.length) setAuctions(r.data.items);

      })

      .catch(() => {});

  }, []);



  const visible = useMemo(

    () =>

      auctions.filter(

        a =>

          (status === 'all' || a.status === status) &&

          `${a.title} ${a.make} ${a.model}`

            .toLowerCase()

            .includes(query.toLowerCase())

      ),

    [auctions, status, query]

  );



  async function auth(e) {

    e.preventDefault();

    setLoading(true);

    setMessage('');



    try {

      const { data } = await api.post(`/auth/${authMode}`, form);

      localStorage.setItem('revbid_token', data.token);

      setUser(data.user);

      setMessage('You are signed in.');

      location.hash = 'auctions';

    } catch (err) {

      setMessage(

        err.response?.data?.error ||

        'API unavailable. Start the server and try again.'

      );

    } finally {

      setLoading(false);

    }

  }



  return (

    <>

      <section className="hero">

        <div className="hero-grid" />

        <div className="hero-copy">

          <div className="kicker">

            <span /> INDIA'S MOTORCYCLE AUCTION HOUSE

          </div>

          <h1>The next chapter<br />starts <em>on two wheels.</em></h1>

          <p>

            Discover exceptional pre-owned motorcycles. Compete in live

            auctions. Ride away with a story worth telling.

          </p>

          <div className="hero-ctas">

            <a href="#auctions" className="btn btn-lime">

              Explore live auctions <ArrowRight size={17} />

            </a>

            <a href="#how" className="text-link">

              How RevBid works <ChevronRight size={17} />

            </a>

          </div>

          <div className="trust-row">

            <span><ShieldCheck size={16} /> Verified listings</span>

            <span><Zap size={16} /> Real-time bidding</span>

            <span><Gavel size={16} /> Fair &amp; transparent</span>

          </div>

        </div>

        <div className="hero-art">

          <div className="hero-image" />

          <div className="floating-tag">

            <span className="live-dot" /> AUCTION IN PROGRESS

            <strong>Interceptor 650</strong>

            <small>Current bid <b>₹2,12,000</b></small>

          </div>

          <div className="hero-index">01 <span>/ 04</span></div>

        </div>

        <div className="hero-foot">

          <span>CURATED RIDES. REAL BIDDERS.</span>

          <span>SCROLL TO DISCOVER ↓</span>

        </div>

      </section>



      <section className="stats-strip">

        <div><strong>100%</strong><span>Transparent bidding</span></div>

        <div><strong>24/7</strong><span>Browse anytime</span></div>

        <div><strong>Live</strong><span>Instant bid updates</span></div>

        <div><strong>India</strong><span>Riders, connected</span></div>

      </section>



      <section className="auction-section section" id="auctions">

        <div className="section-heading">

          <div>

            <div className="kicker dark-kicker">THE AUCTION FLOOR</div>

            <h2>Find your <em>next ride.</em></h2>

            <p>Handpicked machines. Clear details. Your next favourite is here.</p>

          </div>

          <div className="search-box">

            <Search size={17} />

            <input

              value={query}

              onChange={e => setQuery(e.target.value)}

              placeholder="Search make or model..."

            />

          </div>

        </div>



        <div className="filters">

          {[

            ['live', 'Live now'],

            ['scheduled', 'Coming soon'],

            ['ended', 'Recently ended'],

            ['all', 'All auctions']

          ].map(([key, label]) => (

            <button

              key={key}

              className={status === key ? 'filter active' : 'filter'}

              onClick={() => setStatus(key)}

            >

              {label}

              {key === 'live' && <span className="filter-dot" />}

            </button>

          ))}

          <span className="results-count">{visible.length} AUCTIONS</span>

        </div>



        <div className="auction-grid">

          {visible.map(a => <AuctionCard key={a._id} a={a} />)}

          {!visible.length && (

            <div className="empty-state">

              No auctions match those filters. Try another search.

            </div>

          )}

        </div>



        <p className="demo-note">

          Preview listings are shown when the API has no seeded auctions.

          Sign in and connect a MongoDB database to enable bidding.

        </p>

      </section>



      <section className="how-section" id="how">

        <div className="section">

          <div className="kicker">STRAIGHTFORWARD BY DESIGN</div>

          <h2>Good rides. <em>No guesswork.</em></h2>

          <div className="steps">

            <article>

              <span>01</span><ShieldCheck size={25} />

              <h3>Find your match</h3>

              <p>

                Explore detailed listings with mileage, location, condition

                notes, and auction timing.

              </p>

            </article>

            <article>

              <span>02</span><Gavel size={25} />

              <h3>Make your move</h3>

              <p>

                Place a valid bid and follow the live price as other registered

                riders compete.

              </p>

            </article>

            <article>

              <span>03</span><Bike size={25} />

              <h3>Ride away</h3>

              <p>

                When the timer ends, the highest valid bidder wins. Clear

                outcomes, no surprises.

              </p>

            </article>

          </div>

        </div>

      </section>



      <section className="login-section section" id="login">

        <div className="login-copy">

          <div className="kicker dark-kicker">YOUR NEXT RIDE AWAITS</div>

          <h2>Ready to make<br />a <em>move?</em></h2>

          <p>

            Create an account to participate in auctions and keep an eye on

            the bikes you love.

          </p>

          <div className="login-perks">

            <span><ShieldCheck size={17} /> Secure account access</span>

            <span><Zap size={17} /> Live auction updates</span>

          </div>

        </div>



        <form className="auth-card" onSubmit={auth}>

          <div className="auth-tabs">

            <button

              type="button"

              className={authMode === 'login' ? 'selected' : ''}

              onClick={() => setAuthMode('login')}

            >

              Sign in

            </button>

            <button

              type="button"

              className={authMode === 'register' ? 'selected' : ''}

              onClick={() => setAuthMode('register')}

            >

              Create account

            </button>

          </div>



          <h3>

            {authMode === 'login'

              ? 'Welcome back.'

              : 'Join the rider community.'}

          </h3>

          <p>

            {authMode === 'login'

              ? 'Sign in to pick up where you left off.'

              : 'A few details, then you’re in.'}

          </p>



          {authMode === 'register' && (

            <label>

              Full name

              <input

                required

                minLength="2"

                value={form.name}

                onChange={e => setForm({ ...form, name: e.target.value })}

                placeholder="Your name"

              />

            </label>

          )}



          <label>

            Email address

            <input

              required

              type="email"

              value={form.email}

              onChange={e => setForm({ ...form, email: e.target.value })}

              placeholder="you@example.com"

            />

          </label>



          <label>

            Password

            <input

              required

              type="password"

              minLength={authMode === 'register' ? 10 : 1}

              value={form.password}

              onChange={e => setForm({ ...form, password: e.target.value })}

              placeholder={

                authMode === 'register'

                  ? 'At least 10 characters'

                  : 'Your password'

              }

            />

          </label>



          <button disabled={loading} className="btn btn-lime auth-submit">

            {loading

              ? 'Please wait…'

              : authMode === 'login'

                ? 'Sign in to RevBid'

                : 'Create your account'}

            <ArrowRight size={17} />

          </button>



          {message && <div className="form-message">{message}</div>}



          <small className="legal-note">

            By continuing, you agree to our Terms of Service and Privacy Policy.

          </small>

        </form>

      </section>



      <footer className="footer">

        <Link className="brand" to="/">

          <span className="brand-icon"><Bike size={20} /></span>

          rev<span>bid</span>

        </Link>

        <span>Built for the love of the ride.</span>

        <span>© 2026 RevBid Auctions</span>

      </footer>

    </>

  );

}
function AuctionDetail({ user }) {
  const { id } = useParams();
  const [auction, setAuction] = useState(sample.find(a => a._id === id));
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Update the countdown once per second.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Fetch the auction and its bid history.
  useEffect(() => {
    if (id.startsWith('demo')) return;
    api.get(`/auctions/${id}`)
      .then(({ data }) => {
        setAuction(data.auction);
        setBids(data.bids || []);
        setAmount(data.auction.currentPrice + data.auction.minIncrement);
      })
      .catch(() => setNotice('Auction could not be loaded.'));
  }, [id]);
  // Real-time bidding and ending events.
  useEffect(() => {
    if (id.startsWith('demo')) return;
    const token = localStorage.getItem('revbid_token');
if (!token) {
  return;
}
      const socket = io(
        import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
        {
          auth: { token },
        }
      );
      socket.on('connect', () => {
        socket.emit('auction:join', id);
      });
      socket.on('connect_error', (error) => {
        console.error('Socket connection failed:', error.message);
      });

    socket.on('bid:placed', data => {
      // Update the current auction price and bid count.
      setAuction(currentAuction =>
        currentAuction
          ? {
              ...currentAuction,
              currentPrice: data.currentPrice,
              bidCount: data.bidCount,
              highestBidder: data.highestBidder ?? currentAuction.highestBidder
            }
          : currentAuction
      );
      // Add the new bid to the recent bid history.
      setBids(currentBids => [
        {
          _id: crypto.randomUUID(),
          amount: data.amount,
          bidder: { name: data.bidder },
          createdAt: data.at
        },
        ...currentBids
      ]);
      // Use the actual minimum increment supplied by the server.
      if (
        Number.isFinite(Number(data.currentPrice)) &&
        Number.isFinite(Number(data.minIncrement))
      ) {
        setAmount(Number(data.currentPrice) + Number(data.minIncrement));
      }
    });
    socket.on('auction:ended', () => {
      setAuction(currentAuction =>
        currentAuction
          ? { ...currentAuction, status: 'ended' }
          : currentAuction
      );
    });
    return () => {
      socket.emit('auction:leave', id);
      socket.disconnect();
    };
  }, [id]);
  if (!auction) {
    return (
      <main className="detail-page">
        <Link to="/">← Back to auctions</Link>
        <h2>Auction not found</h2>
        <p>
          {notice ||
            'This preview listing is not stored in the database.'}
        </p>
      </main>
    );
  }
  const remaining = Math.max(
    0,
    new Date(auction.endsAt).getTime() - now
  );
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isEnded = auction.status === 'ended' || remaining === 0;
  // Prefer the server-provided winning bidder ID when available.
  const winningBid = bids.find(
    b =>
      auction.highestBidder &&
      String(b.bidder?._id || '') === String(auction.highestBidder)
  );
  const highestBid = bids.reduce(
    (best, current) =>
      !best || current.amount > best.amount ? current : best,
    null
  );
  const winnerName =
    winningBid?.bidder?.name || highestBid?.bidder?.name || null;
  async function bid(e) {
    e.preventDefault();
    if (!user) {
      setNotice('Sign in first to place a bid.');
      location.hash = 'login';
      return;
    }
    if (isEnded || auction.status !== 'live') {
      setNotice('This auction has ended. Bidding is closed.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const { data } = await api.post(`/auctions/${id}/bids`, {
        amount: Number(amount),
        idempotencyKey: crypto.randomUUID()
      });
      // Update the auction with the latest values returned by the server.
      setAuction(data.auction);
      // Suggest the next valid bid using this auction's minimum increment.
      setAmount(
        Number(data.auction.currentPrice) +
        Number(data.auction.minIncrement)
      );
      setNotice('Your bid was placed successfully.');
    } catch (e) {
      setNotice(
        e.response?.data?.error ||
        'Could not place bid. Please retry.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="detail-page">
      <Link className="back-link" to="/#auctions">
        ← Back to auctions
      </Link>
      <div className="detail-grid">
        <div>
          <div
            className="detail-photo"
            style={{
              backgroundImage: `url(${auction.imageUrl || sample[0].imageUrl})`
            }}
          />
          <div className="detail-description">
            <div className="kicker dark-kicker">THE DETAILS</div>
            <h2>Built for the <em>long way home.</em></h2>
            <p>
              {auction.description ||
                'Explore this pre-owned motorcycle and review its listing details before placing your bid.'}
            </p>
            <div className="detail-specs">
              <div>
                <small>MODEL YEAR</small>
                <strong>{auction.year}</strong>
              </div>
              <div>
                <small>ODOMETER</small>
                <strong>
                  {Number(auction.mileageKm).toLocaleString('en-IN')} km
                </strong>
              </div>
              <div>
                <small>LOCATION</small>
                <strong>{auction.location || 'India'}</strong>
              </div>
              <div>
                <small>MIN. INCREMENT</small>
                <strong>{money(auction.minIncrement)}</strong>
              </div>
            </div>
          </div>
        </div>
        <aside className="bid-panel">
          <span
            className={`status-pill ${
              auction.status === 'live' && !isEnded ? 'is-live' : ''
            }`}

          >

            <i />

            {isEnded ? 'AUCTION ENDED' : auction.status.toUpperCase()}

          </span>



          <h1>{auction.title}</h1>

          <p className="eyebrow">

            {auction.make} · {auction.model}

          </p>



          <div className="current-bid">

            <small>{isEnded ? 'FINAL PRICE' : 'CURRENT HIGHEST BID'}</small>

            <strong>{money(auction.currentPrice)}</strong>

            <span>{auction.bidCount || 0} bids so far</span>

          </div>



          <div className="ends-box">

            <Clock3 size={18} />

            <div>

              <small>{isEnded ? 'AUCTION CLOSED' : 'TIME REMAINING'}</small>

              <strong>

                {isEnded

                  ? 'Bidding has ended'

                  : remaining > 0

                    ? `${days}d ${hours}h ${minutes}m ${seconds}s`

                    : 'Closing auction…'}

              </strong>

              <small>

                Deadline: {new Date(auction.endsAt).toLocaleString('en-IN')}

              </small>

            </div>

          </div>



          {isEnded ? (

            <div className="detail-description">

              <h3>Auction results</h3>

              {winnerName ? (

                <p>

                  Winning bidder: <strong>{winnerName}</strong>

                </p>

              ) : (

                <p>

                  {auction.bidCount > 0

                    ? 'Bids were placed, but winner details are unavailable.'

                    : 'This auction ended without a recorded winning bid.'}

                </p>

              )}

              <p>

                Final price: <strong>{money(auction.currentPrice)}</strong>

              </p>

            </div>

          ) : (

            <form onSubmit={bid} className="bid-form">

              <label>

                Your bid (₹)

                <input

                  type="number"

                  min={auction.currentPrice + auction.minIncrement}

                  step="1"

                  value={amount || auction.currentPrice + auction.minIncrement}

                  onChange={e => setAmount(e.target.value)}

                  required

                />

              </label>



              <small>

                Minimum next bid:{' '}

                {money(auction.currentPrice + auction.minIncrement)}

              </small>



              <button

                className="btn btn-lime auth-submit"

                disabled={busy || auction.status !== 'live' || isEnded}

              >

                {busy ? 'Submitting…' : 'Place bid'} <Gavel size={17} />

              </button>

            </form>

          )}



          {notice && <p className="form-message">{notice}</p>}



          <div className="bid-history">

            <h3>Recent bids</h3>

            {bids.length ? (

              bids.map((b, i) => (

                <div className="bid-row" key={b._id || i}>

                  <span className="avatar">

                    {(b.bidder?.name || 'B').slice(0, 1).toUpperCase()}

                  </span>

                  <span>

                    <b>{b.bidder?.name || 'Bidder'}</b>

                    <small>

                      {new Date(b.createdAt).toLocaleString('en-IN')}

                    </small>

                  </span>

                  <strong>{money(b.amount)}</strong>

                </div>

              ))

            ) : (

              <p className="muted">No bids yet. Be the first to bid.</p>

            )}

          </div>

        </aside>

      </div>

    </main>

  );

}





export default function App() {

  const [user, setUser] = useState(null);

  const [authLoading, setAuthLoading] = useState(

    Boolean(localStorage.getItem('revbid_token'))

  );



  useEffect(() => {

    if (!localStorage.getItem('revbid_token')) {

      setAuthLoading(false);

      return;

    }



    api.get('/auth/me')

      .then(r => setUser(r.data.user))

      .catch(() => {

        localStorage.removeItem('revbid_token');

      })

      .finally(() => setAuthLoading(false));

  }, []);



  function logout() {

    localStorage.removeItem('revbid_token');

    setUser(null);

  }



  return (

    <>

      <Header user={user} onLogout={logout} />



      <Routes>

        <Route

          path="/"

          element={<Home user={user} setUser={setUser} />}

        />



        <Route

          path="/auction/:id"

          element={<AuctionDetail user={user} />}

        />



        <Route

          path="/admin"

          element={

            authLoading ? (

              <main className="detail-page">

                <p>Checking account permissions…</p>

              </main>

            ) : (

              <Admin user={user} />

            )

          }

        />



        <Route

          path="*"

          element={

            <main className="detail-page">

              <h2>Page not found</h2>

              <Link to="/">Return home</Link>

            </main>

          }

        />

      </Routes>

    </>

  );

}
