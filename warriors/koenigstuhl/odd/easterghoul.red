;redcode-94nop
;name Easter Ghoul
;author S.Fernandes
;strategy oneshot
;assert CORESIZE==8000

        org    scan

step    equ    6728
gap     equ    6
first   equ    loop+step

ptr     dat    first+gap ,  first
        dat    0     ,  0
x       dat    1     ,  9
clr     spl    #4000 ,  12
        mov    *x    ,  >ptr
        mov    x     ,  >ptr
        djn.f  clr+1 ,  }clr
        dat    0     ,  0
        dat    0     ,  0
loop    add    inc   ,  ptr
scan    sne    *ptr  ,  @ptr
        add    inc   ,  ptr
        sne    @ptr  ,  *ptr
        djn.f  loop  ,  *ptr
        djn.f  clr   ,  ptr
inc     dat    step  ,  step
