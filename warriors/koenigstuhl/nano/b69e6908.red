;redcode-nano
;name b69e6908-a5be0bba-ab4445f7.rc
;author bvowk
;assert 1

START  SPL.F  #    38, >    12
       MOV.I  #    24, <     1
       MOV.I  <     0, {   -36
       DJN.I  $    -2, <    -5
       JMP.F  #    21, <   -22
       END      START

