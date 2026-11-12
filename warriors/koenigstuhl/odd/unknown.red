;redcode
;name UnKNOWn
;author Lukasz Adamowski
;assert 1

start   spl     $1
        spl     $1
        spl     $1
        spl     $9*11*13,       $0
        mov     >-1,    }-1
        spl     $15*17+3,       $0
        mov     >-1,    }-1
        add     #6*7,   $-4
        mov     $bomb,  <-5
        jmp     $-2,    <-6
bomb    dat     $1,     $1

        end     start
