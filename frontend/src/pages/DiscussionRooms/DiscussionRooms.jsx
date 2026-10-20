import { useEffect, useState } from 'react';
import { ArrowRight, Hash, MessageSquarePlus, Search, UsersRound, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import { useMessages } from '../../contexts/MessageContext.jsx';
import { discussionService } from '../../services/discussion/discussion.service.js';
import MessageThread from '../../components/MessageThread/MessageThread.jsx';
import styles from './DiscussionRooms.module.css';

export default function DiscussionRooms() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [roomName, setRoomName] = useState('');
  const { rooms, loading, error: listError, refresh } = useMessages();
  const [active, setActive] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const filteredRooms = rooms.filter(room => `${room.name} ${room.description}`.toLowerCase().includes(search.toLowerCase()));

  // Keep an open room in sync when the shared room list refreshes.
  useEffect(() => {
    if (!loading) setActive(current => current ? rooms.find(room => Number(room.id) === Number(current.id)) || null : null);
  }, [rooms, loading]);

  const create = async (event) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await discussionService.create(name.trim(), description.trim());
      const list = (await discussionService.list()).data || [];
      await refresh();
      setActive(list.find(room => Number(room.id) === Number(created.data.id)));
      setName(''); setDescription('');
      setShowForm(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const rename = async event => {
    event.preventDefault();
    if (busy || !roomName.trim()) return;
    setBusy(true); setError('');
    try {
      await discussionService.rename(active.id, roomName.trim());
      setActive({ ...active, name: roomName.trim() });
      setRenaming(false);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const removeRoom = async () => {
    if (busy) return;
    const room = active;
    const accepted = await confirm({ title: 'Delete discussion room?', message: `Delete “${room.name}” and all its messages and attachments? This cannot be undone.`, confirmLabel: 'Delete room' });
    if (!accepted) return;
    setBusy(true); setError('');
    try {
      await discussionService.remove(room.id);
      setActive(null); setRenaming(false);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const roomControls = active && Number(active.userId) === Number(user?.id) && <div className={styles.roomControls}>
    {renaming ? <form onSubmit={rename} className={styles.renameForm}>
      <input autoFocus aria-label="New room name" value={roomName} onChange={event => setRoomName(event.target.value)} maxLength={100} required disabled={busy} />
      <button type="submit" className={styles.primary} disabled={busy || !roomName.trim()}>Save</button>
      <button type="button" className={styles.iconButton} aria-label="Cancel rename" disabled={busy} onClick={() => setRenaming(false)}><X size={16} /></button>
    </form> : <>
      <button type="button" className={styles.roomAction} disabled={busy} onClick={() => { setRoomName(active.name); setRenaming(true); }}><Pencil size={15} /> Rename</button>
      <button type="button" className={styles.roomAction} disabled={busy} onClick={removeRoom}><Trash2 size={15} /> Delete room</button>
    </>}
  </div>;

  return <div className={styles.page}>
    {(error || listError) && <p className={styles.error} role="alert">{error || listError}</p>}
    <div className={`${styles.grid} ${active ? styles.showChat : ''}`}>
      <aside className={styles.panel}>
        <div className={styles.panelHeading}><div><h1>Discussion rooms</h1><small>{rooms.length} rooms</small></div><button type="button" className={styles.addButton} aria-label="New room" onClick={() => setShowForm(true)}><MessageSquarePlus size={18} /></button></div>
        <div className={styles.search}><Search size={15} /><input aria-label="Search discussion rooms" placeholder="Find a room…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        {loading ? <p className={styles.empty} role="status">Loading rooms…</p> : rooms.length === 0 && <p className={styles.empty}>No rooms yet. Create the first one.</p>}
        <div className={styles.list}>{filteredRooms.map(room => <button type="button" key={room.id} aria-pressed={active?.id === room.id} className={`${styles.item} ${active?.id === room.id ? styles.active : ''}`} disabled={busy} onClick={() => { setActive(room); setRenaming(false); }}><span className={styles.avatar}><Hash size={19} /></span><span className={styles.itemCopy}><strong>{room.name}</strong><span>{room.lastMessage || room.description || `Created by ${room.firstName} ${room.lastName}`}</span></span>{Number(room.unreadCount) > 0 && <span className={styles.badge} aria-label={`${room.unreadCount} unread messages`}>{Number(room.unreadCount) > 99 ? '99+' : room.unreadCount}</span>}</button>)}</div>
        {!loading && rooms.length > 0 && filteredRooms.length === 0 && <p className={styles.empty}>No rooms match your search.</p>}
        {showForm ? <form onSubmit={create} className={styles.form}>
          <div className={styles.panelHeading}><h2>Create a room</h2><button type="button" className={styles.iconButton} aria-label="Close room form" onClick={() => setShowForm(false)}><X size={16} /></button></div>
          <label htmlFor="room-name">Room name</label><input id="room-name" autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="e.g. React study group" />
          <label htmlFor="room-description">Description (optional)</label><textarea id="room-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="What will you discuss?" />
          <button disabled={busy || !name.trim()} className={styles.primary}><MessageSquarePlus size={14} />{busy ? 'Creating…' : 'Create room'}</button>
        </form> : <button type="button" className={styles.newRoom} onClick={() => setShowForm(true)}><MessageSquarePlus size={16} /> Create a room <ArrowRight size={14} /></button>}
      </aside>
      {active ? <MessageThread key={active.id} id={active.id} title={active.name} description={active.description} kind="discussion" onBack={() => { setActive(null); setRenaming(false); }} headerActions={roomControls} service={discussionService} /> : <section className={styles.placeholder}><span className={styles.placeholderIcon}><UsersRound size={34} /></span><span className={styles.kicker}>Ideas grow here</span><h2>Find your next conversation</h2><p>Choose a room to share what you’re learning, ask for a fresh perspective, or help someone move forward.</p><button type="button" className={styles.primary} onClick={() => setShowForm(true)}><MessageSquarePlus size={15} /> Create a discussion room</button></section>}
    </div>
  </div>;
}
