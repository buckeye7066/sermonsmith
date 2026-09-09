import {it,expect} from 'vitest';
import {publicShareResource} from './sharePrivacy.js';
it('removes account and author metadata recursively from shared content',()=>{
  expect(publicShareResource({title:'Sermon',user_id:'owner',author_name:'Private owner',profile:{email:'private@example.com'},sections:[{text:'Published text',created_by:'owner',token:'secret'}]})).toEqual({title:'Sermon',sections:[{text:'Published text'}]});
});

it('preserves authored sermon text, citations and scripture references',()=>{
  const sermon={title:'A sermon',points:[{text:'Teaching',citations:[{author_name:'Cited author',reference:'Book p. 1'}],supporting_scriptures:['John 3:16']}]};
  expect(publicShareResource(sermon)).toEqual(sermon);
});
