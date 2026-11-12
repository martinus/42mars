;redcode-odd
;name L: Hopeless Hopper
;author John Metcalf
;strategy hopeless hopper ;-)
;assert 1

notsilk:nop   0,        1105
        add.a #8,       notsilk
copy:   mov   db,       <notsilk-30
        mov   db,       <notsilk-30
        mov   {notsilk, <notsilk
        jmn.a copy,     notsilk
        jmp   @notsilk, <notsilk-30
db:     dat   <-1,      <1
        end
