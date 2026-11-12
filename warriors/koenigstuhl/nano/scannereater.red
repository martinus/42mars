;redcode-nano
;author Roy van Rijn
;name ScannerEater
;strategy Oneshot that eats all backwards scanning scanners
;assert 1

      add.ba  #-7     , #-5
      jmz.i   @0      , *-1
      mov.i   0       , }-2
      jmp {0,}0

end 1

