;redcode-94x
;name 29th minute warrior
;author John Metcalf
;strategy semi-reversible d-clear IRCT08
;       CORESIZE==800
;assert 1

       ORG      START
       MOV.I  $     4, >    -5
       DJN.F  $    -1, >    -6
       MOV.I  $    -2, >    -5
START  SPL.B  $     0, $     0
       DAT.F  {    -1, $    10
       END
