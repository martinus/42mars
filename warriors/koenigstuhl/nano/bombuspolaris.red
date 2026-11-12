;redcode-nano
;name Bombus Polaris
;author S.Fernandes
;strategy spl mov mov mov djn
;assert CORESIZE==80

START  SPL.B  #    27, }   -10
      MOV.I  >    20, }    -1
      MOV.I  #     9, }    -2
      MOV.I  }   -27, }    -3
      DJN.F  $    -3, }    -4
      END

