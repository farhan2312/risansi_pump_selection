// Run ONCE, when the "Pump Model & Qty" wizard step is merged to main.
//
// The new step is inserted as step 8, so Approval moves 8 -> 9 and
// Recommendation 9 -> 10. general_info_input stores the step each tag was
// last on (wizard_step) and the furthest reached (wizard_max_step); every
// value >= 8 has to move up by one, or a tag saved on Approval would reopen
// on the new step. step_approval (steps 1-7) is unaffected.
//
//   node scripts/renumber-wizard-steps-pump-model-qty.cjs          -> dry run
//   node scripts/renumber-wizard-steps-pump-model-qty.cjs --apply  -> commit
//
// Guarded: it marks the column when applied and refuses to run a second time.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MARK = "renumbered for Pump Model & Qty (step 8)";
const apply = process.argv.includes("--apply");

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const c = new Client({
  host: env.DB_HOST, port: +env.DB_PORT || 5432, database: env.DB_NAME,
  user: env.DB_USER, password: env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();
  try {
    const mark = (await c.query(
      `select col_description('general_info_input'::regclass, attnum) d
         from pg_attribute where attrelid = 'general_info_input'::regclass and attname = 'wizard_step'`,
    )).rows[0]?.d;
    if (mark === MARK) {
      console.log("Already applied - nothing to do.");
      return;
    }
    const dist = async () =>
      (await c.query(`select wizard_step s, wizard_max_step m, count(*)::int n from general_info_input
                       group by 1, 2 order by 1, 2`)).rows;
    console.table(await dist());
    await c.query("BEGIN");
    const s = await c.query(`update general_info_input set wizard_step = wizard_step + 1 where wizard_step >= 8`);
    const m = await c.query(`update general_info_input set wizard_max_step = wizard_max_step + 1 where wizard_max_step >= 8`);
    console.log(`wizard_step moved: ${s.rowCount}, wizard_max_step moved: ${m.rowCount}`);
    const bad = (await c.query(`select count(*)::int n from general_info_input where wizard_step > 10 or wizard_max_step > 10`)).rows[0].n;
    if (bad) throw new Error(`${bad} rows would exceed step 10`);
    console.table(await dist());
    if (!apply) {
      await c.query("ROLLBACK");
      console.log("Dry run - rolled back. Re-run with --apply to commit.");
      return;
    }
    await c.query(`comment on column general_info_input.wizard_step is '${MARK}'`);
    await c.query("COMMIT");
    console.log("COMMITTED");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("ROLLED BACK:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
