;redcode-nano
;name ethereal being
;author raptor
;strategy a man may die but not his ideas
;assert CORESIZE==80

SPL.B  #     9, }      0
MOV.I  >    31, }     -1
MOV.I  >    41, }     -2
MOV.I  #    10, }     -3
DJN.F  $    -2, }     -4
END

