;redcode-nano
;author Roy van Rijn
;name Double Loop
;strategy Scanner with djn protection in a invisible line
;assert 1

      add.ba  #-7     , #-5
      jmz.i   @0      , *-1
      mov.i   0       , }-2
      djn.f   -2      , <-11
      jmp     {0      , }0


end 1

