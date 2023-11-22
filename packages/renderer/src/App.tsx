import {useEffect, useState} from 'react';

const App = () => {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadHost = async () => {
      setLoading(true);
      const host = await window.config.get('host');
      const devices = await window.devices.get();
      console.log(devices);
      setHost(host);
      setLoading(false);
    };
    loadHost();
  }, []);

  const onSave = async () => {
    setLoading(true);
    await window.config.set('host', host);
    setLoading(false);
  };

  return (
    <form>
      <label>{'Host: '}</label>
      <input
        value={host}
        type="text"
        onChange={e => setHost(e.target.value)}
        disabled={loading}
      />
      <button
        onClick={() => onSave()}
        disabled={loading}
      >
        Guardar
      </button>
      {loading && <div> Cargando...</div>}
    </form>
  );
};
export default App;
