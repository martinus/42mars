;redcode-nano
;author Roy van Rijn
;name Safe
;strategy Same scanner as Double Loop but with imp as djn backup
;assert 1

        add.ba  #-7     , #-5
        jmz.i   @0      , *-1
        mov.i   0       , }-2
        djn.f   -2      , <-11
        mov.i   #1      , 1

end 1

