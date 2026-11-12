;redcode-nano
;name _kill.switch
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

        org    sptr
scan    sub    #38,      sptr
sptr    jmz.f  scan,     10
        mov.i  #6,       >sptr
        djn.f  sptr,     <38
        mov.i  #17,      1

