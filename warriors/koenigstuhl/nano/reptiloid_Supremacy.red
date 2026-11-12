;redcode-nano
;name Reptiloid Supremacy
;author inversed
;strategy Clear with DAT bomb, evolved with ArmsRace
;date 2025.05.16
;assert CORESIZE == 80

ORG 1
DAT.B  {   32, }   76
SPL.I  #   48, >   49
MOV.I  $   -2, <    1
MOV.I  <    0, {   31
DJN.F  $   -2, {   70
