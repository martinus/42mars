;redcode-nano verbose
;date Tue Jan 16 18:12:48 UTC 2007
;name Forgotten Moon
;author Fluffy
;strategy Watch the Moon! 
;assert CORESIZE == 80
        
        ORG start   

start   spl.x   # 77, > 40
        mov.i   # 22, < 17  
        mov.i   * 42, { 78  
        mov.i   > 47, < 31  
        djn.i   $ 78, < 58

        END
