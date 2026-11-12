;redcode-94odd
;author Roy van Rijn
;assert 1
;name Double clear
;strategy Oversized dclear (double) should survive some bombing

ptr     dat 0,30
start   spl s2,>ptr
s1      spl #0,>ptr
b1      mov bmb,>ptr
for 10
        mov bmb,>ptr
rof
        djn.f b1,>ptr
s2      spl #0,>ptr
b2      mov bmb,>ptr
for 10
        mov bmb,>ptr
rof
        djn.f b2,>ptr
bmb     dat <-1,>32
end start
