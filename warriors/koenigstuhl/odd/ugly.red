;redcode
;name small and ugly
;author Sascha Zapf
;assert 1

     


ptr     dat     8,   2        
dbmb    dat     8,   1 
start   spl     #8,  1
        mov     @ptr, }ptr
        jmp     -1, <-8

        end start