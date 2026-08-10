import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/config.mjs';

function responseMock() {
  return {
    headers:{}, statusCode:0, body:null,
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.statusCode=code;return this;},
    json(value){this.body=value;return this;}
  };
}

test('config endpoint exposes only public relay configuration', () => {
  const oldURL=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL='https://abc.supabase.co'; process.env.SUPABASE_ANON_KEY='public-anon-key';
  const res=responseMock(); handler({},res);
  assert.equal(res.statusCode,200); assert.equal(res.body.configured,true); assert.equal(res.body.supabaseUrl,'https://abc.supabase.co');
  process.env.SUPABASE_URL=oldURL; process.env.SUPABASE_ANON_KEY=oldKey;
});
