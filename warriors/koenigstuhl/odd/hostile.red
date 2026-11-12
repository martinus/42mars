;redcode-94
;name hostile
;author Simon Wainwright
;strategy oneshot scan, clear
;assert 1
clear   mov   cbomb,   <ptr
        mov   cbomb,   {ptr
        djn.f clear,    ptr
cbomb   dat   -3991,    -11
scan    add.x   inc,    ptr
ptr     sne    3901,   -101
        djn.f  scan,   <ptr
inc     jmp   clear,     -8
        end     ptr
