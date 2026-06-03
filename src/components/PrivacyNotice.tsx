import { ShieldCheck, Phone } from "lucide-react";

export default function PrivacyNotice() {
  return (
    <div className="bg-slate-800 rounded-xl p-5 text-white">
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} className="text-slate-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-2">Privacy & Safeguarding</h3>
          <ul className="text-xs text-slate-400 space-y-1 leading-relaxed">
            <li>· Minimum necessary information displayed</li>
            <li>· Personal identifiers and exact addresses are hidden</li>
            <li>· Direct contact details not shown</li>
            <li>· Role-based access applies to all users</li>
            <li>· Community requests are not emergency services</li>
          </ul>
        </div>
        <div className="bg-red-900/40 border border-red-700/40 rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
          <Phone size={12} className="text-red-400" />
          <div>
            <p className="text-xs text-red-300 font-semibold">Life-threatening?</p>
            <p className="text-xs text-red-400">Call 995 immediately</p>
          </div>
        </div>
      </div>
    </div>
  );
}
