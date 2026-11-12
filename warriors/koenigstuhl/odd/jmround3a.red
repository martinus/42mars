;redcode-?
;name Toxic-8
;author John Metcalf
;strategy paper/imp
;assert CORESIZE==8000

fact    mul.x  #6,       #4
        mul.x  fact,     fact
is      div    #3,       @ind2
        mul.b  fact,     papera
        mul.b  fact,     paperb
        add.b  paperc,   @ind1

        spl    1,        >papera
ind2    spl    1,        >paperc
ind1    spl    1,        {imp

papera  spl    @0,       {-5
        mov    }papera,  >papera
paperb  spl    @0,       }3
        mov    }paperb,  >paperb
paperc  spl    @0,       }-2
        mov    }paperc,  >paperc
        mov.i  #1,       {1
imp     mov.i  #-8,      1
