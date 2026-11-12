;redcode
;name Clear-O-Matic
;author Sascha Zapf
;strategy Second entry for IRC-mini No.:8
;assert 1

       ORG      START
       DJN.B  $    -2, $   -10
       MOV.I  $     2, <     1
       SPL.B  #     0, $     0
START  MOV.I  $     2, <     1
       DJN.B  $    -2, $   -10
       END
