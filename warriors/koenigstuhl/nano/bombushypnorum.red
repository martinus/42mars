;redcode-nano
;name Bombus Hypnorum
;author S.Fernandes
;strategy spl mov mov mov djn
;assert CORESIZE==80

       ORG      START
START  SPL.B  #    -9, {     8     
       MOV.I  >    -8, <   -25     
       MOV.I  }    29, >    -2     
       MOV.I  >    -3, {    -3     
       DJN.F  $    -3, {    -4     
       END
