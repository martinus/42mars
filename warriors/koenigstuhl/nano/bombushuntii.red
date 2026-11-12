;redcode-nano
;name Bombus Huntii
;author S.Fernandes
;strategy spl mov mov mov mov
;assert CORESIZE==80

       ORG      START
START  SPL.B  #   -22, }    11
       MOV.I  >   -44, {   -11
       MOV.I  {    -2, >    -2
       MOV.I  >    -3, {    -3
       mov.i  #     1, $     1
       END
