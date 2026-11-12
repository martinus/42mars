;redcode-94ld
;name Orc
;author Christian Schmidt
;strategy paper
;strategy redcoders frenzy r-12
;assert 1

pStep  equ   197
bStep  equ    52

        spl   2
        spl   1
        spl   1
        spl   pap2

pap1    spl   pStep, {3
        mov   }2,    }-1
        mov   3,     >bStep
        mov   3,     }-3
        jmz.f -4,    *-1
        dat   <1,    <-1

   for  80
        dat   0,     0
   rof

pap2    spl   pStep, {3
        mov   }2,    }-1
        mov   3,     >bStep
        mov   3,     }-3
        jmz.f -4,    *-1
        dat   <1,    <-1

end
