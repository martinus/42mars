;redcode-nano 
;name 82f15b5-14be1e3d-1f97e6f6.rc 
;author bvowk 
;assert 1 

START  SPL.BA #   -11, <    33 
       MOV.I  *    20, {    -1 
       MOV.I  >    34, <    -2 
       DJN.X  $    -2, $    -3 
       SPL.A  @     0, *     0 
       END      START 
