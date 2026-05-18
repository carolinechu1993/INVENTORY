export default function ChipInput({ value, onChange, options = [], placeholder }) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const active = value === o
            return (
              <button
                type="button"
                key={o}
                onClick={() => onChange(o)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  active
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-600 border-slate-300 active:bg-slate-100'
                }`}
              >
                {o}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
