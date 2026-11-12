;redcode-odd
;name squid 2
;author will 'varfar'
;strategy evolved with species, but for a 8000 hill
;and just a few generations :-/
;assert 1
;       (CORESIZE==6000) && (MAXCYCLES==60000) && (MAXPROCESSES==6000)

        ORG     START
        spl.f  *-3043 , <    0
START   spl.b  #   -1 , < 3506
        mov.i  $  -63 , $   30
        add.ab #  244 , $   -1
        djn.f  $   -2 , <   -5
        mov.a  {    0 , @    0
        stp.b  #   -1 , @    0
        spl.f  $    0 , @  -28
        jmz.b  $    6 , #   -3
        mov.i  @   -1 , >   21
        END
