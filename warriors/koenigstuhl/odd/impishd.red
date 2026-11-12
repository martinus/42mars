;redcode
;name Impish :D
;author PaulKhuong
;assert 1
        jmp     #0,     >-4
boot2   spl     -1,     >-5
        mov     #2,     *0
        mov     #2,     *0
boot1   spl     boot2,  {-10
        mov     #2,     *0
        mov     #2,     *0
start   spl     boot1,  }-10
        mov     #2,     *0
        mov     #2,     *0
end start