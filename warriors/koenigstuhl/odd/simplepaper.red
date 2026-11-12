;redcode-94
;name simple paper
;author John Metcalf
;strategy very quick hack, untested
;assert 1
spl 2
spl 2
spl 1
spl 1
pap1:spl @0,>1098
mov }pap1,>pap1
pap2:spl 2430,0
mov >pap2,}pap2
mov bomb,>1890
mov bomb,>2890
mov bomb,>3890
mov <pap2,<pap3
pap3:djn.f @0,>4860
bomb:dat >2667,>5334
end
