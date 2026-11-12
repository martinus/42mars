;redcode-nano
;name hectic
;author John Metcalf
;strategy another mad mad bomber evolved with TEV0
;strategy benchmark score 162.1 after 60 hours 2009-05-31
;assert CORESIZE==80

spl.b #-31, <-37
mov.i #6,   <18
mov.i >60,  <41
mov.i *-4,  <-5
djn.f $-1,  <-28
end

