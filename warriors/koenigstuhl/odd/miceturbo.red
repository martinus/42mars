;redcode
;name Mice Turbo
;author Zul Nadzri
;strategy Faster Mice (original by Chip Wendell)
;strategy Starting at loop with preset ptr
;assert 1
 
ptr     dat     #0     ,  #12
start   mov     #12    ,  ptr
loop    mov     @ptr   ,  <copy
        djn     loop   ,  ptr
        spl     @copy  ,  0
        add     #653   ,  copy
        jmz     start  ,  ptr
copy    dat     #0     ,  #833
        end     loop