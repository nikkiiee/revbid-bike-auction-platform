
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';

const money = value =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value || 0);

const emptyForm = {
  title: '',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  mileageKm: 0,
  description: '',
  imageUrl: '',
  location: '',
  startingPrice: '',
  minIncrement: 500,
  startsAt: '',
  endsAt: ''
};

function localDateTime(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Admin({ user }) {
  const [form, setForm] = useState(emptyForm);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/auctions?limit=30');
      setAuctions(data.items || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Could not load auctions. Check that the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadAuctions();
  }, [isAdmin, loadAuctions]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  async function createAuction(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const start = new Date(form.startsAt);
    const end = new Date(form.endsAt);

    if (!form.startsAt || !form.endsAt || end <= start) {
      setError('The end date must be later than the start date.');
      setSaving(false);
      return;
    }

    if (end <= new Date()) {
      setError('The auction end date must be in the future.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        year: Number(form.year),
        mileageKm: Number(form.mileageKm),
        startingPrice: Number(form.startingPrice),
        minIncrement: Number(form.minIncrement),
        startsAt: start.toISOString(),
        endsAt: end.toISOString()
      };

      const { data } = await api.post('/auctions', payload);

      setMessage(`Auction "${data.auction.title}" created successfully.`);
      setForm(emptyForm);
      await loadAuctions();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Could not create the auction. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelAuction(auction) {
    const confirmed = window.confirm(
      `Cancel "${auction.title}"? This action is only available for auctions with no bids.`
    );

    if (!confirmed) return;

    setMessage('');
    setError('');

    try {
      await api.patch(`/auctions/${auction._id}/cancel`);
      setMessage('Auction cancelled successfully.');
      await loadAuctions();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Could not cancel this auction.'
      );
    }
  }

  if (!user) {
    return (
      <main className="detail-page">
        <h2>Sign in required</h2>
        <p>Sign in with your administrator account to manage auctions.</p>
        <Link className="btn btn-dark" to="/#login">Go to sign in</Link>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="detail-page">
        <h2>Access denied</h2>
        <p>Your account does not have administrator permissions.</p>
        <Link className="btn btn-dark" to="/">Return home</Link>
      </main>
    );
  }

  return (
    <main className="detail-page admin-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> Back to website
      </Link>

      <div className="section-heading">
        <div>
          <div className="kicker dark-kicker">REV BID MANAGEMENT</div>
          <h1>Admin <em>dashboard.</em></h1>
          <p>Create listings and manage your motorcycle auctions.</p>
        </div>

        <button
          className="btn btn-dark"
          type="button"
          onClick={loadAuctions}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Refreshing…' : 'Refresh listings'}
        </button>
      </div>

      {message && <p className="form-message">{message}</p>}
      {error && <p className="form-message" role="alert">{error}</p>}

      <section className="detail-description">
        <h2><Plus size={20} /> Create motorcycle auction</h2>

        <form className="admin-form" onSubmit={createAuction}>
          <label>
            Listing title
            <input
              name="title"
              required
              minLength={5}
              maxLength={120}
              value={form.title}
              onChange={updateField}
              placeholder="2023 Royal Enfield Himalayan"
            />
          </label>

          <div className="admin-form-grid">
            <label>
              Make
              <input
                name="make"
                required
                maxLength={60}
                value={form.make}
                onChange={updateField}
                placeholder="Royal Enfield"
              />
            </label>

            <label>
              Model
              <input
                name="model"
                required
                maxLength={60}
                value={form.model}
                onChange={updateField}
                placeholder="Himalayan"
              />
            </label>

            <label>
              Year
              <input
                name="year"
                type="number"
                required
                min="1950"
                max="2100"
                value={form.year}
                onChange={updateField}
              />
            </label>

            <label>
              Mileage (km)
              <input
                name="mileageKm"
                type="number"
                required
                min="0"
                value={form.mileageKm}
                onChange={updateField}
              />
            </label>

            <label>
              Starting price (₹)
              <input
                name="startingPrice"
                type="number"
                required
                min="1"
                step="1"
                value={form.startingPrice}
                onChange={updateField}
                placeholder="150000"
              />
            </label>

            <label>
              Minimum bid increment (₹)
              <input
                name="minIncrement"
                type="number"
                required
                min="1"
                step="1"
                value={form.minIncrement}
                onChange={updateField}
              />
            </label>

            <label>
              Auction starts
              <input
                name="startsAt"
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={updateField}
              />
            </label>

            <label>
              Auction ends
              <input
                name="endsAt"
                type="datetime-local"
                required
                value={form.endsAt}
                onChange={updateField}
              />
            </label>
          </div>

          <label>
            Location
            <input
              name="location"
              maxLength={120}
              value={form.location}
              onChange={updateField}
              placeholder="Hyderabad, Telangana"
            />
          </label>

          <label>
            Image URL
            <input
              name="imageUrl"
              type="url"
              value={form.imageUrl}
              onChange={updateField}
              placeholder="https://example.com/motorcycle.jpg"
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              maxLength={5000}
              rows={4}
              value={form.description}
              onChange={updateField}
              placeholder="Condition, service history, ownership details…"
            />
          </label>

          <button
            className="btn btn-lime auth-submit"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Creating auction…' : 'Create auction'}
            <Plus size={17} />
          </button>
        </form>
      </section>

      <section className="admin-listings">
        <h2>Existing auctions</h2>

        {loading && <p>Loading listings…</p>}

        {!loading && auctions.length === 0 && (
          <p>No auctions found yet.</p>
        )}

        {auctions.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Motorcycle</th>
                  <th>Status</th>
                  <th>Current price</th>
                  <th>Bids</th>
                  <th>Ends</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {auctions.map(auction => (
                  <tr key={auction._id}>
                    <td>
                      <Link to={`/auction/${auction._id}`}>
                        <strong>{auction.title}</strong>
                      </Link>
                      <small>
                        {auction.make} · {auction.model}
                      </small>
                    </td>

                    <td>
                      <span className={`status-pill ${auction.status === 'live' ? 'is-live' : ''}`}>
                        {auction.status.toUpperCase()}
                      </span>
                    </td>

                    <td>{money(auction.currentPrice)}</td>
                    <td>{auction.bidCount || 0}</td>

                    <td>
                      {new Date(auction.endsAt).toLocaleString('en-IN')}
                    </td>

                    <td>
                      {['live', 'scheduled'].includes(auction.status) &&
                      (auction.bidCount || 0) === 0 ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => cancelAuction(auction)}
                        >
                          <XCircle size={15} /> Cancel
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
