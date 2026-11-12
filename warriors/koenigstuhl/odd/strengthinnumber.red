;redcode
;name strength in number
;author PaulKhuong
;assert 1
db      dat     0,      -10
boot1   spl     #0,     {db
        mov     @0,     >db
        mov     @0,     >db
        jmp     -1,     {db
start   spl     boot1,  <db-1
        spl     #0,     {db
        mov     @0,     >db
        mov     @0,     >db
        jmp     -1,     {db
end start