;redcode-94x
;name Tainted
;author John Metcalf
;strategy imp for IRCT08
;       CORESIZE==800
;assert 1

       ORG      START
       SPL.B  $   268, <   -20
       MOV.I  $    -1, $   267
       MOV.I  #    -2, $   267
START  SPL.B  *     1, <    -3
       MOV.I  #    -4, $     1
       END
