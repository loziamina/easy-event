import { useEffect, useState } from 'react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch('/api/admin/audit')
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []));
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Historique des actions</h2>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Acteur</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entite</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-3">{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                <td className="p-3">{log.actor?.name || log.actor?.email || 'Systeme'}</td>
                <td className="p-3 font-semibold text-gray-800">{log.action}</td>
                <td className="p-3">{[log.entity, log.entityId].filter(Boolean).join(' #')}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="p-6 text-gray-500" colSpan="4">Aucune action enregistree.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
