;redcode
;name TopsyTurvy
;author Philip Thorne
;strategy Reversible bomber for Mini IRC tournament R8 [hosted by Roy]
;author Philip Thorne
;       CORESIZE==800
;assert 1

       ORG      START
       ADD.AB #   319, *    -1
       SPL.B  $    -1, >     2
       MOV.I  $     3, <    -4
START  SPL.B  $    -2, >    -2
       ADD.AB #   319, *    -1
       END
