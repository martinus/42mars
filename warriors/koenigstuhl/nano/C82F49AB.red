;redcode-nano
;name 82f15b5-49ab1f46-2609ed04.rc
;author bvowk
;assert 1

START  SPL.F  #   -14, <    33
       MOV.I  @    14, {    -1
       MOV.I  >    39, <    -2
       DJN.I  $    -2, $    -3
       SPL.BA @     0, <     0
       END      START
