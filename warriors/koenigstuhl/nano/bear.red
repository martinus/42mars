;redcode-nano 
;assert CORESIZE == 80 
;name Bear
;author  Ken Hubbard 
;strategy  Redrace-evolved clear. I adjusted the pointers in the 
;strategy  first line to reduce gaps in the coverage 


start  spl.b  #    32, >    56       ;evolved as spl.b #28, >61 
       mov.i  }   -29, {    -4 
       mov.i  > start, {    -1 
       mov.i  >    33, {    start 
       dat.ab >    35, {    start 


end   0 
